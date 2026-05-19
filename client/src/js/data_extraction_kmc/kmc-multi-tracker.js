/**
 * kmc-multi-tracker.js
 * ─────────────────────────────────────────────────────────────────
 * Loaded by index_kmc_multi.html (Multiple Building page).
 * Saves upload metadata + combined CSV to Firebase Realtime DB,
 * using the same paths as kmc-upload-tracker.js so the dashboard
 * shows both single and multi uploads together.
 *
 * Requires:
 *  - feature-shell.js already executed (provides window.cymUser)
 *  - Firebase compat SDKs on page
 *  - KMCMulti API available (window.KMCMulti)
 *
 * Called from index_kmc_multi.html via:
 *   window.mbTrackUpload(blockLabels, masterFileName)
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

  /* Save upload record + combined CSV to Firebase */
  async function trackMultiUpload(user, blockLabels, masterName) {
    const uid = user.uid;
    const db  = dbUploads(uid);
    if (!db) { console.warn('[mb-tracker] Firebase DB not available'); return; }

    const now        = Date.now();
    const id         = 'kmc_multi_' + now;
    const fileNames  = [masterName, ...blockLabels.map(l => l + '.dxf')];

    /* Get per-block CSVs from KMCMulti */
    let masterCsv = '';
    const blockCsvs = {};
    try {
      if (window.KMCMulti) {
        masterCsv = KMCMulti.getMasterCSV() || '';
        blockLabels.forEach(l => { blockCsvs[l] = KMCMulti.getBlockCSV(l) || ''; });
      }
    } catch (_) {}

    const combinedCsv = window.KMCMulti ? KMCMulti.getAllCombined() : '';
    const csvBytes   = combinedCsv ? new Blob([combinedCsv]).size : 0;
    const sizeLabel  = csvBytes > 1024 * 1024
      ? (csvBytes / (1024 * 1024)).toFixed(1) + ' MB'
      : Math.round(csvBytes / 1024) + ' KB';

    const record = {
      id,
      name:        `Multiple Building (${blockLabels.length} block${blockLabels.length !== 1 ? 's' : ''})`,
      type:        'multi',
      files:       fileNames,
      masterFile:  masterName,
      blockLabels,
      size:        csvBytes,
      sizeLabel,
      uploadedAt:  now,
      expiresAt:   now + ONE_MONTH_MS,
      uploadPage:  location.pathname,
    };

    try {
      /* Save metadata */
      await db.child(id).set(record);
      console.log('[mb-tracker] Multi upload recorded:', record.name);

      /* Notify dashboard */
      try { window.opener?.postMessage({ cymKmcUpload: record }, '*'); } catch (_) {}
      try { window.parent?.postMessage({ cymKmcUpload: record }, '*'); } catch (_) {}

      /* Save CSV data — master + per-block separately so View can restore each block */
      if (combinedCsv || masterCsv) {
        const csvRef = firebase.database().ref(`users/${uid}/kmc_csv_data/${id}`);
        const payload = {
          csv:       combinedCsv,          // combined (legacy fallback)
          master:    masterCsv,
          blocks:    blockCsvs,
          expiresAt: now + ONE_MONTH_MS,
        };
        await csvRef.set(payload);
        console.log('[mb-tracker] CSV data saved for uploadId:', id);
      }

    } catch (err) {
      console.warn('[mb-tracker] Failed to save upload record:', err);
    }
  }

  /* Public API — called from index_kmc_multi.html after extraction */
  window.mbTrackUpload = function (blockLabels, masterName) {
    onAuthReady(user => trackMultiUpload(user, blockLabels, masterName));
  };

})();
