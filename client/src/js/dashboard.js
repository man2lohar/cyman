/**
 * dashboard.js
 * Professional dashboard: Overview, KMC Uploads, Profile
 * Called from main.js via window.onDashboardUserReady(user, db)
 */

import { getAuth, updateProfile, updatePassword,
         EmailAuthProvider, reauthenticateWithCredential }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref as dbRef, onValue, remove, set, query,
         orderByChild, limitToLast }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as stRef, uploadBytes,
         getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const auth    = getAuth();
const storage = getStorage();

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/* ── Tab switching ───────────────────────────────────────────── */
window.switchTab = (tab) => {
  document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
  const nav = document.querySelector(`[data-tab="${tab}"]`);
  if (nav) nav.classList.add('active');
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.add('active');
};
document.querySelectorAll('.dash-nav-item').forEach(item =>
  item.addEventListener('click', () => window.switchTab(item.dataset.tab))
);

/* ── Greeting ────────────────────────────────────────────────── */
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('dashGreeting');
  if (el) el.textContent =
    h < 12 ? 'Good morning ☀️' :
    h < 18 ? 'Good afternoon 👋' : 'Good evening 🌙';
}

/* ── Escape helper ───────────────────────────────────────────── */
function esc(s) {
  return String(s || '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW
══════════════════════════════════════════════════════════════ */
function loadOverview(user, db) {
  setGreeting();

  // Update avatar in sidebar
  const dashAv  = document.getElementById('dashAvatar');
  const dashNm  = document.getElementById('dashUserEmail');
  const dashSub = document.getElementById('dashUserRole');
  if (dashAv) {
    if (user.photoURL) {
      dashAv.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      dashAv.textContent = (user.displayName || user.email)[0].toUpperCase();
    }
  }
  if (dashNm)  dashNm.textContent  = user.displayName || user.email.split('@')[0];
  if (dashSub) dashSub.textContent = user.email;

  // Stats: count KMC uploads
  const uploadsRef = dbRef(db, `users/${user.uid}/kmc_uploads`);
  onValue(uploadsRef, snap => {
    const uploads   = snap.val() ? Object.values(snap.val()) : [];
    const now       = Date.now();
    const active    = uploads.filter(u => !u.expiresAt || u.expiresAt > now);
    const expSoon   = active.filter(u => u.expiresAt && (u.expiresAt - now) < 7*24*60*60*1000);

    // Update stat cards
    const sc = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    sc('stat-uploads',   active.length);
    sc('stat-expiring',  expSoon.length);
    sc('stat-total',     uploads.length);

    // Recent uploads in overview (last 3)
    const recent = [...active]
      .sort((a,b) => (b.uploadedAt||0)-(a.uploadedAt||0))
      .slice(0, 3);
    renderRecentUploads(recent, user.uid);
  }, { onlyOnce: true });
}

function renderRecentUploads(list, uid) {
  const el = document.getElementById('recentUploadsList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="dash-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>No uploads yet. Open KMC Data Extraction to get started.</p>
    </div>`;
    return;
  }
  el.innerHTML = list.map(u => `
    <div class="upload-row">
      <div class="upload-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d98fd" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="upload-info">
        <div class="upload-name">${esc(u.name)}</div>
        <div class="upload-meta">${u.sizeLabel || '—'} · ${new Date(u.uploadedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
      </div>
      <button class="upload-view-btn" onclick="viewKmcUpload('${u.id}','${esc(u.name)}')">
        View
      </button>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════════════
   KMC UPLOADS TAB
══════════════════════════════════════════════════════════════ */
function loadKmcUploads(user, db) {
  const loading = document.getElementById('uploadsLoading');
  const empty   = document.getElementById('uploadsEmpty');
  const list    = document.getElementById('uploadsList');
  if (!loading) return;

  loading.style.display = 'block';
  empty.style.display   = 'none';
  list.style.display    = 'none';

  const uploadsRef = dbRef(db, `users/${user.uid}/kmc_uploads`);
  onValue(uploadsRef, snap => {
    loading.style.display = 'none';
    const now     = Date.now();
    const allRecs = snap.val() ? Object.values(snap.val()) : [];

    // Auto-prune expired
    allRecs
      .filter(r => r.expiresAt && r.expiresAt < now)
      .forEach(r => remove(dbRef(db, `users/${user.uid}/kmc_uploads/${r.id}`)));

    const active = allRecs
      .filter(r => !r.expiresAt || r.expiresAt > now)
      .sort((a,b) => (b.uploadedAt||0) - (a.uploadedAt||0));

    // Badge
    const badge = document.getElementById('uploadBadge');
    if (badge) {
      badge.textContent    = active.length;
      badge.style.display  = active.length ? 'inline-flex' : 'none';
    }

    if (!active.length) { empty.style.display = 'block'; return; }

    list.style.display = 'block';
    list.innerHTML = active.map(r => {
      const uploaded  = new Date(r.uploadedAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      const expiresAt = new Date(r.expiresAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
      const daysLeft  = Math.ceil((r.expiresAt - now) / (24*60*60*1000));
      const urgCls    = daysLeft <= 5 ? 'expires-urgent' : daysLeft <= 10 ? 'expires-warn' : '';
      return `
      <div class="upload-row" id="urow-${r.id}">
        <div class="upload-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d98fd" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
        </div>
        <div class="upload-info">
          <div class="upload-name">${esc(r.name || 'Unnamed file')}</div>
          <div class="upload-meta">
            <span>${r.sizeLabel || '—'}</span>
            <span>·</span>
            <span>Uploaded ${uploaded}</span>
          </div>
          <div class="upload-expiry ${urgCls}">
            🗓 Expires ${expiresAt}
            ${daysLeft <= 5 ? `<span class="expires-chip">⚠ ${daysLeft}d left</span>` : ''}
          </div>
        </div>
        <div class="upload-actions">
          <button class="upload-view-btn" onclick="viewKmcUpload('${r.id}','${esc(r.name||'')}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View
          </button>
          <button class="upload-del-btn" onclick="deleteKmcUpload('${user.uid}','${r.id}')" title="Delete record">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  });
}

window.viewKmcUpload = (uploadId, fileName) => {
  window.open(
    `client/public/features/data_extraction_kmc/index_kmc.html?uploadId=${uploadId}`,
    '_blank'
  );
};

window.deleteKmcUpload = (uid, key, db_param) => {
  if (!confirm('Delete this upload record?')) return;
  const database = window._cymDb;
  if (!database) return;
  remove(dbRef(database, `users/${uid}/kmc_uploads/${key}`))
    .then(() => {
      const row = document.getElementById('urow-' + key);
      if (row) row.remove();
      const list = document.getElementById('uploadsList');
      if (list && !list.querySelector('.upload-row'))
        document.getElementById('uploadsEmpty').style.display = 'block';
    });
};

/* ══════════════════════════════════════════════════════════════
   PROFILE TAB
══════════════════════════════════════════════════════════════ */
function loadProfile(user) {
  // Fill current values
  const nameEl  = document.getElementById('profileDisplayName');
  const emailEl = document.getElementById('profileEmail');
  const photoEl = document.getElementById('profilePhotoPreview');
  if (nameEl)  nameEl.value     = user.displayName || '';
  if (emailEl) emailEl.value    = user.email || '';
  if (photoEl) {
    photoEl.src = user.photoURL || '';
    photoEl.style.display = user.photoURL ? 'block' : 'none';
  }
}

window.saveProfile = async () => {
  const auth    = getAuth();
  const user    = auth.currentUser;
  const nameEl  = document.getElementById('profileDisplayName');
  const msgEl   = document.getElementById('profileMsg');
  const fileEl  = document.getElementById('profilePhotoFile');
  if (!user || !nameEl) return;

  showProfileMsg('Saving…', 'info');
  try {
    let photoURL = user.photoURL || '';

    // Upload photo if selected
    if (fileEl && fileEl.files[0]) {
      const file    = fileEl.files[0];
      const ext     = file.name.split('.').pop();
      const sRef    = stRef(storage, `users/${user.uid}/avatar.${ext}`);
      await uploadBytes(sRef, file);
      photoURL = await getDownloadURL(sRef);
      // Update preview
      const prev = document.getElementById('profilePhotoPreview');
      if (prev) { prev.src = photoURL; prev.style.display = 'block'; }
      // Update header avatar
      const ag = document.getElementById('authGroup');
      if (ag) ag.querySelector('.profile-trigger img')?.setAttribute('src', photoURL);
    }

    await updateProfile(user, { displayName: nameEl.value.trim(), photoURL });
    showProfileMsg('Profile updated ✓', 'success');

    // Update sidebar avatar
    const dashAv = document.getElementById('dashAvatar');
    if (dashAv) {
      if (photoURL) {
        dashAv.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        dashAv.textContent = (nameEl.value || user.email)[0].toUpperCase();
      }
    }
    const dashNm = document.getElementById('dashUserEmail');
    if (dashNm) dashNm.textContent = nameEl.value || user.email.split('@')[0];

  } catch (err) {
    showProfileMsg('Error: ' + err.message, 'error');
  }
};

window.changePassword = async () => {
  const auth     = getAuth();
  const user     = auth.currentUser;
  const curEl    = document.getElementById('currentPassword');
  const newEl    = document.getElementById('newPassword');
  const confEl   = document.getElementById('confirmPassword');
  if (!user || !curEl || !newEl || !confEl) return;

  if (newEl.value !== confEl.value) {
    showProfileMsg('New passwords do not match.', 'error'); return;
  }
  if (newEl.value.length < 6) {
    showProfileMsg('New password must be at least 6 characters.', 'error'); return;
  }

  showProfileMsg('Updating password…', 'info');
  try {
    const cred = EmailAuthProvider.credential(user.email, curEl.value);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newEl.value);
    curEl.value = ''; newEl.value = ''; confEl.value = '';
    showProfileMsg('Password changed successfully ✓', 'success');
  } catch (err) {
    const msgs = {
      'auth/wrong-password':   'Current password is incorrect.',
      'auth/requires-recent-login': 'Please sign out and sign in again first.',
    };
    showProfileMsg(msgs[err.code] || err.message, 'error');
  }
};

function showProfileMsg(text, type) {
  const el = document.getElementById('profileMsg');
  if (!el) return;
  el.textContent   = text;
  el.className     = 'profile-msg ' + type;
  el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* Photo preview on file select */
window.previewPhoto = (input) => {
  if (!input.files[0]) return;
  const prev = document.getElementById('profilePhotoPreview');
  if (prev) {
    prev.src           = URL.createObjectURL(input.files[0]);
    prev.style.display = 'block';
  }
};

/* ══════════════════════════════════════════════════════════════
   ENTRY POINT — called from main.js onAuthStateChanged
══════════════════════════════════════════════════════════════ */
window.onDashboardUserReady = (user, db) => {
  window._cymDb = db;
  loadOverview(user, db);
  loadKmcUploads(user, db);
  loadProfile(user);
};
