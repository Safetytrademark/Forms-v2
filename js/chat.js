// ── Project Chat ──────────────────────────────────────────────────────────────
// Shared between foreman app (index.html) and admin panel (admin.html).
// Requires: sbClient (supabase-client.js)

let _chatProjectId   = null;   // UUID of the active project
let _chatProjectName = '';
let _chatChannel     = null;   // Supabase Realtime channel
let _chatRole        = 'foreman'; // 'foreman' | 'admin'
let _chatContainerId = null;   // DOM id of the messages <div>

// ═══════════════════════════════════════════════════════════════════════════
//  FOREMAN SIDE — inner-page
// ═══════════════════════════════════════════════════════════════════════════

async function openChatPage() {
  const project = (typeof state !== 'undefined') ? state.project : null;
  if (!project) {
    if (typeof showToast === 'function') showToast('Please select a project first ↑', 'warning');
    return;
  }

  // Resolve project ID from name
  const { data: proj } = await sbClient
    .from('projects').select('id').eq('name', project).single();
  if (!proj) { if (typeof showToast === 'function') showToast('Project not found.', 'error'); return; }

  _chatProjectId   = proj.id;
  _chatProjectName = project;
  _chatRole        = 'foreman';
  _chatContainerId = 'chatMessages';

  if (typeof showInnerPage === 'function') showInnerPage('chatPage');

  const titleEl = document.getElementById('chatPageProject');
  if (titleEl) titleEl.textContent = project;

  // Hide form back-nav strip (not needed on inner pages)
  const formNav = document.getElementById('formPageNav');
  if (formNav) formNav.style.display = 'none';

  await _loadAndRenderChat('chatMessages');
  _subscribeToChat('chatMessages');
  _markChatRead(_chatProjectId);
  _scrollChatToBottom('chatMessages');
}

function closeChatPage() {
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

  // Count projects with unread messages
  let totalUnread = 0;
  projRows.forEach(p => {
    const lastMsg  = latestByProj[p.id];
    const lastRead = (() => { try { return localStorage.getItem(`chat_read_${p.id}`); } catch(_){return null;} })();
    if (lastMsg && (!lastRead || lastMsg > lastRead)) totalUnread++;
  });

  if (totalUnread > 0) {
    badge.textContent  = totalUnread > 9 ? '9+' : String(totalUnread);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
function chatEsc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
