// ── Project Chat ──────────────────────────────────────────────────────────────
// Shared between foreman app (index.html) and admin panel (admin.html).
// Requires: sbClient (supabase-client.js)

let _chatProjectId   = null;   // UUID of the active project
let _chatProjectName = '';
let _chatChannel     = null;   // Supabase Realtime channel
let _chatRole        = 'foreman'; // 'foreman' | 'admin'
let _chatContainerId = null;   // DOM id of the messages <div>

// ═══════════════════════════════════════════════════════════════════════════
//  FOREMAN SIDE — inner-page with project sidebar
// ═══════════════════════════════════════════════════════════════════════════

async function openChatPage() {
  _chatRole        = 'foreman';
  _chatContainerId = 'chatMessages';

  if (typeof showInnerPage === 'function') showInnerPage('chatPage');

  // Hide form back-nav strip (not needed on inner pages)
  const formNav = document.getElementById('formPageNav');
  if (formNav) formNav.style.display = 'none';

  await _loadForemanChatSidebar();

  // Auto-open the active project's chat if one is already selected
  const activeProject = (typeof state !== 'undefined') ? state.project : null;
  if (activeProject) {
    const sidebarEl = document.getElementById('foremanChatSidebar');
    const item = sidebarEl?.querySelector(`[data-project-name="${CSS.escape(activeProject)}"]`);
    if (item) item.click();
  }

  if (typeof requestChatNotificationPermission === 'function') requestChatNotificationPermission();
}

async function _loadForemanChatSidebar() {
  const sidebar = document.getElementById('foremanChatSidebar');
  if (!sidebar) return;
  sidebar.innerHTML = '<div class="chat-loading">Loading…</div>';

  const projectNames = window.userProjects || [];
  if (!projectNames.length) {
    sidebar.innerHTML = '<div class="chat-empty" style="padding:20px;font-size:13px">No projects assigned.</div>';
    return;
  }

  // Resolve names → UUIDs + latest message preview
  const { data: projRows } = await sbClient
    .from('projects').select('id, name').in('name', projectNames);
  if (!projRows?.length) {
    sidebar.innerHTML = '<div class="chat-empty" style="padding:20px;font-size:13px">No projects found.</div>';
    return;
  }

  const ids = projRows.map(p => p.id);
  const { data: latestMsgs } = await sbClient
    .from('project_messages')
    .select('project_id, body, sender_name, sender_role, created_at')
    .in('project_id', ids)
    .order('created_at', { ascending: false });

  const latestByProj = {};
  (latestMsgs || []).forEach(m => {
    if (!latestByProj[m.project_id]) latestByProj[m.project_id] = m;
  });

  // Sort: projects with messages first (most recent), then alphabetical
  projRows.sort((a, b) => {
    const la = latestByProj[a.id]?.created_at || '';
    const lb = latestByProj[b.id]?.created_at || '';
    if (la && lb) return lb.localeCompare(la);
    if (la) return -1;
    if (lb) return  1;
    return a.name.localeCompare(b.name);
  });

  sidebar.innerHTML = projRows.map(p => {
    const last    = latestByProj[p.id];
    const preview = last
      ? (last.body
          ? (last.body.length > 38 ? last.body.slice(0, 38) + '…' : last.body)
          : '📎 Attachment')
      : 'No messages yet';
    const senderPrefix = last
      ? (last.sender_role === 'admin' ? 'Admin: ' : last.sender_name?.split(' ')[0] + ': ')
      : '';
    const lastRead  = (() => { try { return localStorage.getItem(`chat_read_${p.id}`); } catch(_){return null;} })();
    const hasUnread = last && (!lastRead || last.created_at > lastRead);
    // Short project label — last segment after " - "
    const shortName = p.name.split(' - ').pop().trim();

    return `<div class="foreman-chat-proj-item ${hasUnread ? 'has-unread' : ''}"
                 data-project-id="${p.id}"
                 data-project-name="${chatEsc(p.name)}"
                 onclick="selectForemanChatProject(this,'${p.id}','${chatEsc(p.name).replace(/'/g,"\\'")}')">
      <div class="foreman-chat-proj-name">${chatEsc(shortName)}</div>
      <div class="foreman-chat-proj-preview">${chatEsc(senderPrefix)}${chatEsc(preview)}</div>
      ${hasUnread ? '<span class="foreman-chat-unread-dot"></span>' : ''}
    </div>`;
  }).join('');
}

async function selectForemanChatProject(el, projectId, projectName) {
  // Highlight selected item
  document.querySelectorAll('.foreman-chat-proj-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  el.classList.remove('has-unread');
  el.querySelector('.foreman-chat-unread-dot')?.remove();

  // Update header title
  const titleEl = document.getElementById('chatPageProject');
  const shortName = projectName.split(' - ').pop().trim();
  if (titleEl) titleEl.textContent = shortName;

  // Show chat footer
  const footer = document.getElementById('foremanChatFooter');
  if (footer) footer.style.display = 'flex';

  // On mobile: slide to chat panel
  const layout = document.querySelector('.foreman-chat-layout');
  if (layout) layout.classList.add('chat-open');

  _unsubscribeChat();
  _chatProjectId   = projectId;
  _chatProjectName = projectName;
  _chatRole        = 'foreman';
  _chatContainerId = 'chatMessages';

  await _loadAndRenderChat('chatMessages');
  _subscribeToChat('chatMessages');
  _markChatRead(projectId);
  _scrollChatToBottom('chatMessages');
}

function closeChatPage() {
  const layout = document.querySelector('.foreman-chat-layout');
  // On mobile: if a chat is open, go back to sidebar instead of home
  if (layout && layout.classList.contains('chat-open') && window.innerWidth <= 600) {
    layout.classList.remove('chat-open');
    _unsubscribeChat();
    _chatProjectId   = null;
    _chatProjectName = '';
    const titleEl = document.getElementById('chatPageProject');
    if (titleEl) titleEl.textContent = 'Select a project';
    const footer = document.getElementById('foremanChatFooter');
    if (footer) footer.style.display = 'none';
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = '<div class="chat-empty">Select a project on the left to start chatting 💬</div>';
    document.querySelectorAll('.foreman-chat-proj-item').forEach(i => i.classList.remove('active'));
    return;
  }
  _unsubscribeChat();
  if (typeof goHome === 'function') goHome();
}

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN SIDE — panel tab
// ═══════════════════════════════════════════════════════════════════════════

async function openAdminChat(projectId, projectName) {
  _unsubscribeChat();
  _chatProjectId   = projectId;
  _chatProjectName = projectName;
  _chatRole        = 'admin';
  _chatContainerId = 'adminChatMessages';

  const wrap = document.getElementById('adminChatMessages');
  if (wrap) wrap.innerHTML = '<div class="chat-loading">Loading…</div>';

  await _loadAndRenderChat('adminChatMessages');
  _subscribeToChat('adminChatMessages');
  _markChatRead(projectId);
  _scrollChatToBottom('adminChatMessages');
  if (typeof requestChatNotificationPermission === 'function') requestChatNotificationPermission();
}

// ═══════════════════════════════════════════════════════════════════════════
//  CORE: load, render, send, subscribe
// ═══════════════════════════════════════════════════════════════════════════

async function _loadAndRenderChat(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap || !_chatProjectId) return;

  wrap.innerHTML = '<div class="chat-loading">Loading…</div>';

  const { data: msgs, error } = await sbClient
    .from('project_messages')
    .select('*')
    .eq('project_id', _chatProjectId)
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) {
    wrap.innerHTML = '<div class="chat-empty">Could not load messages.</div>';
    return;
  }
  if (!msgs?.length) {
    wrap.innerHTML = '<div class="chat-empty">No messages yet — say something! 👋</div>';
    return;
  }

  wrap.innerHTML = '';
  let lastDate = '';
  msgs.forEach(m => {
    const msgDate = new Date(m.created_at).toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' });
    if (msgDate !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'chat-date-sep';
      sep.textContent = msgDate;
      wrap.appendChild(sep);
      lastDate = msgDate;
    }
    wrap.insertAdjacentHTML('beforeend', _renderBubble(m));
  });
}

function _renderBubble(m) {
  const myId  = window.currentUser?.id || window.adminCurrentUser?.id;
  const isOwn = m.sender_id === myId;
  const isAdmin = m.sender_role === 'admin';

  let cls = 'chat-bubble ';
  cls += isOwn ? 'chat-bubble--own' : isAdmin ? 'chat-bubble--admin' : 'chat-bubble--other';

  const time = new Date(m.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  let content = '';

  // Attachment first
  if (m.file_url) {
    const isImg = (m.file_type || '').startsWith('image/')
      || /\.(jpg|jpeg|png|gif|webp|heic|heif|avif)$/i.test(m.file_name || '');
    if (isImg) {
      content += `<a href="${m.file_url}" target="_blank" rel="noopener" class="chat-attachment-img-wrap">
        <img class="chat-attachment-img" src="${m.file_url}" alt="${chatEsc(m.file_name||'Image')}" loading="lazy">
      </a>`;
    } else {
      content += `<a href="${m.file_url}" target="_blank" rel="noopener" class="chat-attachment-file">
        📎 ${chatEsc(m.file_name || 'File')}
      </a>`;
    }
  }

  // Text body
  if (m.body) {
    content += `<div class="chat-body">${chatEsc(m.body)}</div>`;
  }

  const senderLabel = !isOwn
    ? `<div class="chat-sender">${chatEsc(m.sender_name)}${isAdmin
        ? ' <span class="chat-admin-tag">Admin</span>' : ''}</div>`
    : '';

  return `
    <div class="${cls}" data-msg-id="${chatEsc(m.id)}">
      ${senderLabel}
      <div class="chat-bubble-inner">${content}</div>
      <div class="chat-time">${time}</div>
    </div>`;
}

// ── Send a message ────────────────────────────────────────────────────────────
async function sendChatMessage(inputId, fileInputId) {
  const inputEl = document.getElementById(inputId);
  const fileEl  = document.getElementById(fileInputId);
  const body    = (inputEl?.value || '').trim();
  const file    = fileEl?.files?.[0];

  if (!body && !file) return;
  if (!_chatProjectId) return;

  const senderId   = window.currentUser?.id || window.adminCurrentUser?.id;
  const senderName = window.currentProfile?.full_name || 'Unknown';
  const senderRole = _chatRole;

  // Optimistically clear input
  if (inputEl) inputEl.value = '';

  let fileUrl = null, fileName = null, fileType = null;

  if (file) {
    const safeName = `${_chatProjectId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { error: upErr } = await sbClient.storage
      .from('chat-files')
      .upload(safeName, file, { upsert: false });
    if (!upErr) {
      const { data: { publicUrl } } = sbClient.storage
        .from('chat-files').getPublicUrl(safeName);
      fileUrl = publicUrl;
      fileName = file.name;
      fileType = file.type || '';
    }
    if (fileEl) fileEl.value = '';
  }

  const { error } = await sbClient.from('project_messages').insert({
    project_id:  _chatProjectId,
    sender_id:   senderId,
    sender_name: senderName,
    sender_role: senderRole,
    body:        body || null,
    file_url:    fileUrl,
    file_name:   fileName,
    file_type:   fileType
  });

  if (error) {
    console.warn('Chat send error:', error.message);
    // Restore text if send failed
    if (inputEl && body) inputEl.value = body;
  }
}

// ── Realtime subscription ─────────────────────────────────────────────────────
function _subscribeToChat(containerId) {
  _unsubscribeChat();
  if (!_chatProjectId) return;

  _chatChannel = sbClient
    .channel(`chat_${_chatProjectId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'project_messages',
        filter: `project_id=eq.${_chatProjectId}` },
      payload => {
        const wrap = document.getElementById(containerId);
        if (!wrap) return;

        // Remove empty state if present
        const empty = wrap.querySelector('.chat-empty');
        if (empty) empty.remove();

        // Add date separator if new day
        const msgDate = new Date(payload.new.created_at)
          .toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' });
        const lastSep = wrap.querySelector('.chat-date-sep:last-of-type');
        if (!lastSep || lastSep.textContent !== msgDate) {
          const sep = document.createElement('div');
          sep.className = 'chat-date-sep';
          sep.textContent = msgDate;
          wrap.appendChild(sep);
        }

        wrap.insertAdjacentHTML('beforeend', _renderBubble(payload.new));
        _scrollChatToBottom(containerId);

        // Notify if message is from someone else and tab is in background
        const myId = window.currentUser?.id || window.adminCurrentUser?.id;
        if (payload.new.sender_id !== myId) {
          if (typeof requestChatNotificationPermission === 'function') requestChatNotificationPermission();
          if (typeof showChatNotification === 'function') showChatNotification(payload.new, _chatProjectName);
        }
      }
    )
    .subscribe();
}

function _unsubscribeChat() {
  if (_chatChannel) {
    sbClient.removeChannel(_chatChannel);
    _chatChannel = null;
  }
}

// ── Scroll to bottom ──────────────────────────────────────────────────────────
function _scrollChatToBottom(containerId) {
  const wrap = document.getElementById(containerId);
  if (wrap) {
    requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UNREAD BADGE (localStorage)
// ═══════════════════════════════════════════════════════════════════════════

function _markChatRead(projectId) {
  if (!projectId) return;
  try { localStorage.setItem(`chat_read_${projectId}`, new Date().toISOString()); } catch (_) {}
}

async function updateChatUnreadBadges() {
  const badge = document.getElementById('chatUnreadBadge');
  if (!badge) return;

  const projects = window.userProjects || [];
  if (!projects.length) { badge.style.display = 'none'; return; }

  // Resolve project UUIDs from names (one query)
  const { data: projRows } = await sbClient
    .from('projects').select('id, name').in('name', projects);
  if (!projRows?.length) { badge.style.display = 'none'; return; }

  // Get latest message per project (one query)
  const ids = projRows.map(p => p.id);
  const { data: latestMsgs } = await sbClient
    .from('project_messages')
    .select('project_id, created_at')
    .in('project_id', ids)
    .order('created_at', { ascending: false });

  const latestByProj = {};
  (latestMsgs || []).forEach(m => {
    if (!latestByProj[m.project_id]) latestByProj[m.project_id] = m.created_at;
  });

  // Count projects with unread messages and collect their short names
  let totalUnread = 0;
  const unreadNames = [];
  projRows.forEach(p => {
    const lastMsg  = latestByProj[p.id];
    const lastRead = (() => { try { return localStorage.getItem(`chat_read_${p.id}`); } catch(_){return null;} })();
    if (lastMsg && (!lastRead || lastMsg > lastRead)) {
      totalUnread++;
      // Extract short name — last part after final " - " (e.g. "25TM010 - Axiom - Firehall" → "Firehall")
      const parts = p.name.split(' - ');
      unreadNames.push(parts[parts.length - 1].trim());
    }
  });

  const hint = document.getElementById('chatUnreadHint');

  if (totalUnread > 0) {
    badge.textContent   = totalUnread > 9 ? '9+' : String(totalUnread);
    badge.style.display = 'flex';
    if (hint) {
      hint.textContent  = '💬 New in: ' + unreadNames.join(', ');
      hint.style.color  = 'var(--accent, #c0272d)';
      hint.style.fontWeight = '600';
    }
  } else {
    badge.style.display = 'none';
    if (hint) {
      hint.textContent  = 'Messages with your team';
      hint.style.color  = '';
      hint.style.fontWeight = '';
    }
  }
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
function chatEsc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
