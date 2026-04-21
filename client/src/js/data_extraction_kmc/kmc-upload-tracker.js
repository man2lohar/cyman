/**
 * kmc-upload-tracker.js
 * ─────────────────────────────────────────────────────────────────
 * Automatically loaded by index_kmc.html.
 * Hooks into the existing #file-input element and saves upload
 * metadata to Firebase Realtime DB for the current user.
 * Records expire after 30 days (enforced by dashboard.js on load).
 *
 * Requires:
 *  - feature-shell.js already executed (provides window.cymUser)
 *  - Firebase compat SDKs on page (loaded by db.js or directly)
 */
(function () {
  'use strict';

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  /* Wait for auth (feature-shell fires cymAuthReady) */
  function onAuthReady(cb) {
    if (window.cymUser) { cb(window.cymUser); return; }
    document.addEventListener('cymAuthReady', e => cb(e.detail.user), { once: true });
  }

  /* Firebase DB reference helper */
  function dbUploads(uid) {
    if (typeof firebase !== 'undefined' && firebase.database) {
      return firebase.database().ref(`users/${uid}/kmc_uploads`);
    }
    return null;
  }

  /* Save upload record */
  async function trackUpload(user, file) {
    const uid  = user.uid;
    const db   = dbUploads(uid);
    if (!db) { console.warn('[kmc-tracker] Firebase DB not available'); return; }

    const now  = Date.now();
    const id   = 'kmc_' + now;
    const record = {
      id,
      name:       file.name,
      size:       file.size,
      sizeLabel:  file.size > 1024 * 1024
                    ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                    : Math.round(file.size / 1024) + ' KB',
      uploadedAt: now,
      expiresAt:  now + ONE_MONTH_MS,
      uploadPage: location.pathname,
    };

    try {
      await db.child(id).set(record);
      console.log('[kmc-tracker] Upload recorded:', record.name);

      // Notify parent window / main site dashboard if open
      try { window.opener?.postMessage({ cymKmcUpload: record }, '*'); } catch (_) {}
      try { window.parent?.postMessage({ cymKmcUpload: record }, '*'); } catch (_) {}
    } catch (err) {
      console.warn('[kmc-tracker] Failed to save upload record:', err);
    }
  }

  /* Attach to file input after auth + DOM ready */
  function attach(user) {
    const fileInput = document.getElementById('file-input');
    if (!fileInput) {
      // Retry briefly in case DOM isn't ready yet
      setTimeout(() => {
        const fi = document.getElementById('file-input');
        if (fi) fi.addEventListener('change', () => handleChange(fi, user), true);
        else console.warn('[kmc-tracker] #file-input not found');
      }, 500);
      return;
    }
    fileInput.addEventListener('change', () => handleChange(fileInput, user), true);
  }

  function handleChange(input, user) {
    const file = input.files[0];
    if (file) {
      // Small delay so existing handlers run first
      setTimeout(() => trackUpload(user, file), 300);
    }
  }

  onAuthReady(user => attach(user));

})();
