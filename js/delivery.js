// ── Delivery Request Logic ────────────────────────────────────────────────────
// Handles the 📦 "Request Delivery" modal for foremans.
// Saves requests to Supabase delivery_requests table.

// ── Open / Close modal ────────────────────────────────────────────────────────
function openDeliveryModal() {
  // Populate project dropdown from the logged-in user's assigned projects
  const sel = document.getElementById('delivProjectSelect');
  if (sel) {
    const projects = window.userProjects || [];
    sel.innerHTML = '<option value="">Select project…</option>' +
      projects.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  // Set default "needed by" to tomorrow
  const neededByEl = document.getElementById('delivNeededBy');
  if (neededByEl && !neededByEl.value) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    neededByEl.value = tomorrow.toISOString().split('T')[0];
  }

  // Reset quantities and error
  document.querySelectorAll('.delivery-qty').forEach(el => { el.value = ''; });
  const errEl = document.getElementById('deliveryError');
  if (errEl) errEl.textContent = '';

  document.getElementById('deliveryModal').style.display = 'flex';
}

function closeDeliveryModal() {
  document.getElementById('deliveryModal').style.display = 'none';
}

// ── Build items object from form inputs ───────────────────────────────────────
function buildDeliveryItems() {
  const qty = id => Math.max(0, parseInt(document.getElementById(id)?.value || '0', 10) || 0);

  return {
    '20cm': {
      standards_2h: qty('b20_standards_2h'),
      bondbeams:    qty('b20_bondbeams'),
      halves:       qty('b20_halves'),
      multiblock:   qty('b20_multiblock'),
      squints:      qty('b20_squints')
    },
    '25cm': {
      standards_2h: qty('b25_standards_2h'),
      bondbeams:    qty('b25_bondbeams'),
      halves:       qty('b25_halves')
    },
    '30cm': {
      standards_2h: qty('b30_standards_2h'),
      bondbeams:    qty('b30_bondbeams'),
      halves:       qty('b30_halves')
    },
    mortar_tek: qty('mat_mortar_tek'),
    blockfill:  qty('mat_blockfill')
  };
}

function totalItems(items) {
  let total = 0;
  ['20cm','25cm','30cm'].forEach(size => {
    if (items[size]) Object.values(items[size]).forEach(v => { total += v; });
  });
  total += (items.mortar_tek || 0) + (items.blockfill || 0);
  return total;
}

// ── Submit request ────────────────────────────────────────────────────────────
async function submitDeliveryRequest() {
  const btn      = document.getElementById('deliverySubmitBtn');
  const errEl    = document.getElementById('deliveryError');
  const projSel  = document.getElementById('delivProjectSelect');
  const projName = projSel?.value || '';
  const neededBy = document.getElementById('delivNeededBy')?.value || null;
  const notes    = (document.getElementById('delivNotes')?.value || '').trim();

  if (errEl) errEl.textContent = '';

  if (!projName) {
    if (errEl) errEl.textContent = 'Please select a project.';
    return;
  }

  const items = buildDeliveryItems();
  if (totalItems(items) === 0) {
    if (errEl) errEl.textContent = 'Enter at least one item quantity.';
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    // Resolve project_id from name
    const { data: project } = await sbClient
      .from('projects').select('id').eq('name', projName).single();

    if (!project) throw new Error('Project not found.');

    const { error } = await sbClient.from('delivery_requests').insert({
      project_id: project.id,
      foreman_id: window.currentUser.id,
      items,
      notes:      notes || null,
      needed_by:  neededBy || null
    });

    if (error) throw error;

    closeDeliveryModal();

    // Show success toast (showToast is defined in app.js)
    if (typeof showToast === 'function') {
      showToast('📦 Delivery request sent!', 'success');
    }

  } catch (err) {
    console.error('Delivery request failed:', err);
    if (errEl) errEl.textContent = err.message || 'Failed to send request. Try again.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Request'; }
  }
}
