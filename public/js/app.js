// Polling intervals cache
let pollingIntervals = {};
let isRequestingQr = false;
let authAction = 'login';

// Tab Switching
function switchTab(tabName) {
  // Update nav link active states (only top-level dashboard tabs, to prevent breaking nested tabs)
  document.querySelectorAll('#dashboard-tabs .nav-link').forEach(btn => btn.classList.remove('active'));
  // Update pane active states (only top-level main panes, to prevent breaking nested tabs)
  document.querySelectorAll('main > .tab-pane').forEach(pane => {
    pane.classList.add('d-none');
    pane.classList.remove('show', 'active');
  });

  // Find active button (only top-level dashboard tabs)
  const activeBtn = document.querySelector(`#dashboard-tabs .nav-link[onclick*="switchTab('${tabName}')"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Show active pane
  const activePane = document.getElementById(`pane-${tabName}`);
  if (activePane) {
    activePane.classList.remove('d-none');
    // Allow Bootstrap grid styles to apply cleanly
    activePane.classList.add('show', 'active');
  }
}

// Toast Notifications (Bootstrap 5 Toast implementation)
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastId = 'toast-' + Date.now();
  let bgClass = 'bg-primary text-white';
  if (type === 'success') bgClass = 'bg-success text-white';
  if (type === 'error') bgClass = 'bg-danger text-white';
  if (type === 'warning') bgClass = 'bg-warning text-dark';

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
  toast.show();

  // Clean up DOM after hide
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Config manual editor
async function handleSaveConfig(event) {
  event.preventDefault();
  const payload = {
    baseUrl: document.getElementById('cfg-base-url').value,
    port: document.getElementById('cfg-port').value,
    token: document.getElementById('cfg-token').value,
    organizationId: document.getElementById('cfg-org-id').value,
    apiKey: document.getElementById('cfg-api-key').value,
    activeSessionId: document.getElementById('cfg-active-session').value
  };

  try {
    const res = await fetch('/api/config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Configuration updated successfully!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to save configuration', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Onboarding assistant Auth
function setAuthAction(action) {
  authAction = action;
}

async function handleAssistantLogin(event) {
  event.preventDefault();
  const email = document.getElementById('assistant-email').value;
  const password = document.getElementById('assistant-password').value;
  const url = authAction === 'register' ? '/api/auth/register' : '/api/auth/login';
  const body = { email, password };
  
  if (authAction === 'register') {
    body.name = email.split('@')[0];
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${authAction === 'register' ? 'Registration' : 'Login'} successful! Session token saved.`, 'success');
      document.getElementById('cfg-token').value = data.token;
      
      const orgBox = document.getElementById('org-helper-box');
      if (orgBox) orgBox.classList.remove('d-none');
      
      fetchOrganizations();
    } else {
      showToast(data.error || 'Authentication failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function fetchOrganizations() {
  try {
    const res = await fetch('/api/auth/organizations');
    const data = await res.json();
    if (data.success) {
      const select = document.getElementById('assistant-org-select');
      select.innerHTML = '';
      if (data.organizations.length === 0) {
        select.innerHTML = '<option value="">No organizations found</option>';
        document.getElementById('btn-save-org').disabled = true;
      } else {
        data.organizations.forEach(org => {
          const opt = document.createElement('option');
          opt.value = org.id;
          opt.innerText = org.name;
          select.appendChild(opt);
        });
        document.getElementById('btn-save-org').disabled = false;
        showToast('Organizations retrieved!', 'success');
      }
    } else {
      showToast(data.error || 'Failed to list organizations', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveSelectedOrganization() {
  const orgId = document.getElementById('assistant-org-select').value;
  if (!orgId) return;

  document.getElementById('cfg-org-id').value = orgId;
  
  try {
    const res = await fetch('/api/config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: document.getElementById('cfg-base-url').value,
        port: document.getElementById('cfg-port').value,
        token: document.getElementById('cfg-token').value,
        organizationId: orgId,
        apiKey: document.getElementById('cfg-api-key').value,
        activeSessionId: document.getElementById('cfg-active-session').value
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Organization saved!', 'success');
      const apiBox = document.getElementById('api-helper-box');
      if (apiBox) apiBox.classList.remove('d-none');
    } else {
      showToast(data.error || 'Failed to save organization config', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function createWalandApiKey() {
  const orgId = document.getElementById('cfg-org-id').value;
  const keyName = document.getElementById('assistant-key-name').value;
  if (!orgId || !keyName) {
    showToast('Active Organization ID and API Key Name are required', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/create-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: keyName, organizationId: orgId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Waland API Key generated and saved successfully!', 'success');
      document.getElementById('cfg-api-key').value = data.apiKey;
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(data.error || 'Failed to generate API Key', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Session management
async function syncSessions() {
  showToast('Syncing sessions...', 'info');
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    if (data.success) {
      showToast('Sessions synced with Waland!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Sync failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCreateSession(event) {
  event.preventDefault();
  const name = document.getElementById('new-session-name').value;
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Session "${name}" created successfully!`, 'success');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to create session', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function selectActiveSession(sessionId) {
  document.getElementById('cfg-active-session').value = sessionId;
  try {
    const res = await fetch('/api/config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: document.getElementById('cfg-base-url').value,
        port: document.getElementById('cfg-port').value,
        token: document.getElementById('cfg-token').value,
        organizationId: document.getElementById('cfg-org-id').value,
        apiKey: document.getElementById('cfg-api-key').value,
        activeSessionId: sessionId
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Active session changed!', 'success');
      
      // Update visual indicators
      document.querySelectorAll('.card').forEach(c => c.classList.remove('active-session'));
      const activeCard = document.getElementById(`session-card-${sessionId}`);
      if (activeCard) activeCard.classList.add('active-session');
      
      const select = document.getElementById('send-session-id');
      if (select) select.value = sessionId;
    } else {
      showToast(data.error || 'Failed to update active session', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function startSession(sessionId) {
  showToast('Starting WhatsApp client...', 'info');
  try {
    const res = await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Session starting...', 'info');
      updateLocalBadge(sessionId, 'initializing');
      pollSessionStatus(sessionId);
    } else if (data.error && data.error.toLowerCase().includes('already started')) {
      showToast('Session is already running. Syncing status...', 'info');
      pollSessionStatus(sessionId);
    } else {
      showToast(data.error || 'Failed to start session', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function stopSession(sessionId) {
  showToast('Stopping session...', 'info');
  try {
    const res = await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Session stopped', 'success');
      updateLocalBadge(sessionId, 'disconnected');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to stop session', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to permanently delete this WhatsApp session?')) return;
  showToast('Deleting session...', 'info');
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Session deleted', 'success');
      const card = document.getElementById(`session-card-${sessionId}`);
      if (card) card.remove();
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast(data.error || 'Failed to delete session', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateLocalBadge(sessionId, status) {
  const badge = document.getElementById(`status-badge-${sessionId}`);
  if (badge) {
    // Clear existing color classes
    badge.className = 'badge';
    
    let colorClass = 'bg-secondary text-white';
    if (status === 'ready') colorClass = 'bg-success text-white';
    if (status === 'qr_ready') colorClass = 'bg-warning text-dark';
    if (status === 'initializing' || status === 'authenticating') colorClass = 'bg-info text-dark';
    if (status === 'disconnected' || status === 'failed') colorClass = 'bg-danger text-white';

    badge.classList.add(...colorClass.split(' '));
    badge.innerHTML = `<span class="status-dot bg-${status} me-1"></span>${status.toUpperCase()}`;
  }

  // Dynamically update action buttons visibility based on the status
  const btnStart = document.getElementById(`btn-start-${sessionId}`);
  const btnStop = document.getElementById(`btn-stop-${sessionId}`);
  const btnQr = document.getElementById(`btn-qr-${sessionId}`);

  if (btnStart) {
    if (status === 'created' || status === 'disconnected' || status === 'failed') {
      btnStart.classList.remove('d-none');
    } else {
      btnStart.classList.add('d-none');
    }
  }

  if (btnStop) {
    if (status === 'ready' || status === 'initializing' || status === 'qr_ready' || status === 'authenticating') {
      btnStop.classList.remove('d-none');
    } else {
      btnStop.classList.add('d-none');
    }
  }

  if (btnQr) {
    if (status === 'qr_ready') {
      btnQr.classList.remove('d-none');
    } else {
      btnQr.classList.add('d-none');
    }
  }
}

async function viewQrCode(sessionId) {
  if (isRequestingQr) return;
  isRequestingQr = true;
  showToast('Fetching QR code from Waland...', 'info');

  const placeholder = document.getElementById('qr-status-placeholder');
  const imgWrapper = document.getElementById('qr-image-wrapper');
  const img = document.getElementById('qr-code-img');

  if (placeholder) placeholder.classList.add('d-none');
  if (imgWrapper) imgWrapper.classList.remove('d-none');
  if (img) {
    img.src = '';
    img.style.opacity = '0.5';
  }

  try {
    const res = await fetch(`/api/sessions/${sessionId}/qr`);
    const data = await res.json();
    if (data.success && data.qrCode) {
      if (img) {
        img.src = data.qrCode;
        img.style.opacity = '1';
      }
      showToast('QR Code loaded! Scan with WhatsApp.', 'success');
      pollSessionStatus(sessionId);
    } else {
      showToast(data.error || 'QR code is not ready yet. Please wait...', 'warning');
      if (placeholder) placeholder.classList.remove('d-none');
      if (imgWrapper) imgWrapper.classList.add('d-none');
    }
  } catch (err) {
    showToast(err.message, 'error');
    if (placeholder) placeholder.classList.remove('d-none');
    if (imgWrapper) imgWrapper.classList.add('d-none');
  } finally {
    isRequestingQr = false;
  }
}

function pollSessionStatus(sessionId) {
  if (pollingIntervals[sessionId]) {
    clearInterval(pollingIntervals[sessionId]);
  }

  pollingIntervals[sessionId] = setInterval(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/status`);
      const data = await res.json();
      if (data.success) {
        const status = data.session.status;

        // Skip updating UI or canceling poller if it's a stale transition state (disconnected + stopped by user)
        if ((status === 'disconnected' || status === 'failed') && data.session.lastError === 'stopped by user') {
          console.log('Session is starting/transitioning (stale state detected), skipping UI update...');
          return;
        }

        updateLocalBadge(sessionId, status);

        if (status === 'ready') {
          clearInterval(pollingIntervals[sessionId]);
          delete pollingIntervals[sessionId];
          
          const placeholder = document.getElementById('qr-status-placeholder');
          const imgWrapper = document.getElementById('qr-image-wrapper');
          
          if (placeholder) {
            placeholder.classList.remove('d-none');
            placeholder.innerHTML = `
              <i class="fa-solid fa-circle-check text-success fs-1 mb-2"></i>
              <p class="fw-bold mb-1">WhatsApp Connected!</p>
              <p class="text-muted small">Session is active and ready to use.</p>
            `;
          }
          if (imgWrapper) imgWrapper.classList.add('d-none');
          
          showToast('WhatsApp Session connected successfully!', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } else if (status === 'qr_ready') {
          // If the QR code is ready and not currently shown or loading, auto-display it!
          const imgWrapper = document.getElementById('qr-image-wrapper');
          if (imgWrapper && imgWrapper.classList.contains('d-none') && !isRequestingQr) {
            viewQrCode(sessionId);
          }
        } else if (status === 'failed' || status === 'disconnected') {
          clearInterval(pollingIntervals[sessionId]);
          delete pollingIntervals[sessionId];
          
          const placeholder = document.getElementById('qr-status-placeholder');
          const imgWrapper = document.getElementById('qr-image-wrapper');
          
          if (placeholder) placeholder.classList.remove('d-none');
          if (imgWrapper) imgWrapper.classList.add('d-none');
          
          if (data.session.lastError === 'stopped by user') {
            showToast('Session stopped successfully.', 'success');
          } else {
            showToast(`Session stopped or failed: ${data.session.lastError || 'Disconnected'}`, 'error');
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 3000);
}

// Messaging Form
async function handleSendMessage(event) {
  event.preventDefault();
  const btn = document.getElementById('btn-send-message');
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Dispatching...';

  const payload = {
    sessionId: document.getElementById('send-session-id').value,
    chatId: document.getElementById('send-recipient').value,
    text: document.getElementById('send-message-text').value,
    mediaUrl: document.getElementById('send-media-url').value
  };

  try {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('WhatsApp message sent successfully!', 'success');
      document.getElementById('send-recipient').value = '';
      document.getElementById('send-message-text').value = '';
      document.getElementById('send-media-url').value = '';
      
      refreshMessageLogs();
      setTimeout(() => switchTab('logs'), 1000);
    } else {
      showToast(data.error || 'Failed to dispatch message', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = prevHtml;
  }
}

async function refreshMessageLogs() {
  try {
    const res = await fetch('/api/messages');
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('logs-table-body');
      if (!tbody) return;

      tbody.innerHTML = '';
      if (data.messages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No messages sent yet.</td></tr>`;
      } else {
        data.messages.forEach(msg => {
          const tr = document.createElement('tr');
          const dateStr = new Date(msg.createdAt).toLocaleString();
          const mediaContent = msg.mediaUrl 
            ? `<a href="${msg.mediaUrl}" target="_blank" class="text-whatsapp-teal font-size-sm">View File</a>`
            : '<span class="text-muted">None</span>';
          
          let badgeColor = 'bg-secondary';
          if (msg.status === 'sent') badgeColor = 'bg-success';
          if (msg.status === 'failed') badgeColor = 'bg-danger';

          const responseCol = msg.status === 'sent'
            ? `<code class="small text-muted">${msg.messageId}</code>`
            : `<span class="text-danger small">${msg.error}</span>`;

          tr.innerHTML = `
            <td>${dateStr}</td>
            <td><span class="badge bg-light text-dark border">${msg.sessionId}</span></td>
            <td><span class="badge bg-light text-dark border">${msg.chatId}</span></td>
            <td class="msg-text-cell" title="${msg.text}">${msg.text}</td>
            <td>${mediaContent}</td>
            <td><span class="badge ${badgeColor}">${msg.status}</span></td>
            <td>${responseCol}</td>
          `;
          tbody.appendChild(tr);
        });
      }
      showToast('Logs updated!', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleResetAll() {
  if (!confirm('Are you sure you want to reset everything? This will clear all credentials from config.json and empty the local SQLite database (sessions & messages). This action cannot be undone.')) {
    return;
  }
  
  try {
    const res = await fetch('/api/config/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('System reset completed successfully!', 'success');
      setTimeout(() => window.location.href = '/', 1500);
    } else {
      showToast(data.error || 'Reset failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copyCode(elementId) {
  const pre = document.getElementById(elementId);
  if (!pre) return;
  const text = pre.innerText.trim();
  navigator.clipboard.writeText(text).then(() => {
    showToast('Command copied to clipboard!', 'success');
  }).catch(err => {
    showToast('Failed to copy command: ' + err.message, 'error');
  });
}

window.addEventListener('load', () => {
  const originSpan = document.getElementById('curl-local-origin');
  if (originSpan) {
    originSpan.innerText = window.location.origin;
  }
});
