/**
 * feature-auth.js
 * ─────────────────────────────────────────────────────────────────
 * Drop ONE <script> tag into any feature HTML (before </body>):
 *
 *   <script src="path/to/feature-auth.js"
 *           data-redirect="login.html"
 *           data-feature="KMC Data Extraction">
 *   </script>
 *
 * data-redirect : path to login.html relative to this feature page
 * data-feature  : display name shown on the login page
 *
 * What it does:
 *  1. Loads Firebase Auth (compat SDK must already be on the page,
 *     OR this script loads it itself when not yet present).
 *  2. If no user → redirects to login.html?redirect=<thisPage>&feature=<name>
 *  3. If user logged in → injects a small top-bar with user initial +
 *     logout button so the user can sign out from inside the feature.
 *  4. Syncs dark mode from localStorage (writes body class "dark-mode").
 * ─────────────────────────────────────────────────────────────────
 */
(function () {
  const script  = document.currentScript;
  const redirectBase = script.getAttribute('data-redirect') || 'login.html';
  const featureName  = script.getAttribute('data-feature')  || 'Feature';

  /* ── Dark mode sync ── */
  function applyDark() {
    const on = localStorage.getItem('cymDark') === '1';
    document.documentElement.setAttribute('data-dark', on ? '1' : '0');
    document.body.classList.toggle('dark-mode', on);
    // inject CSS variables if body doesn't already have them
    if (!document.getElementById('_cymDarkVars')) {
      const s = document.createElement('style');
      s.id = '_cymDarkVars';
      s.textContent = `
        [data-dark="1"] {
          --bg:#0f1117!important; --card-bg:#181b27!important;
          --brown:#e8eaf6!important; --input-bg:#1e2130!important;
          --border:rgba(255,255,255,0.06)!important;
          background-color:#0f1117!important; color:#e8eaf6!important;
        }
        [data-dark="1"] .card, [data-dark="1"] .modal-content,
        [data-dark="1"] .card-panel, [data-dark="1"] .sidebar,
        [data-dark="1"] .main, [data-dark="1"] .topbar {
          background:#181b27!important; color:#e8eaf6!important;
        }
        [data-dark="1"] input, [data-dark="1"] select,
        [data-dark="1"] textarea, [data-dark="1"] .form-control,
        [data-dark="1"] .form-select {
          background:#1e2130!important; color:#e8eaf6!important;
          border-color:rgba(255,255,255,0.1)!important;
        }
        [data-dark="1"] table, [data-dark="1"] th,
        [data-dark="1"] td { border-color:rgba(255,255,255,0.06)!important; }
        [data-dark="1"] .table { color:#e8eaf6!important; }
        [data-dark="1"] .text-muted { color:#8892b0!important; }
      `;
      document.head.appendChild(s);
    }
  }
  applyDark();
  // re-apply if another tab changes dark setting
  window.addEventListener('storage', e => { if (e.key === 'cymDark') applyDark(); });

  /* ── Inject top-bar HTML (hidden until auth confirmed) ── */
  const bar = document.createElement('div');
  bar.id = '_cymBar';
  bar.style.cssText = [
    'position:fixed', 'top:0', 'right:0', 'z-index:9999',
    'display:none', 'align-items:center', 'gap:8px',
    'padding:6px 14px',
    'background:rgba(45,152,253,.12)',
    'backdrop-filter:blur(8px)',
    'border-bottom-left-radius:12px',
    'font-family:Plus Jakarta Sans,sans-serif',
    'font-size:.78rem', 'font-weight:600',
    'color:#2d98fd',
  ].join(';');
  bar.innerHTML = `
    <span id="_cymUserDot" style="
      width:28px;height:28px;border-radius:50%;
      background:linear-gradient(135deg,#2d98fd,#1a7edf);
      color:#fff;display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:.82rem;flex-shrink:0;
      box-shadow:0 2px 8px rgba(45,152,253,.35);">?</span>
    <span id="_cymUserName">…</span>
    <button id="_cymLogout" style="
      background:rgba(255,75,75,.1);border:none;cursor:pointer;
      padding:4px 10px;border-radius:8px;color:#d93025;
      font-size:.72rem;font-weight:700;font-family:inherit;
      transition:.2s;" title="Sign Out">Sign Out</button>
    <button id="_cymDarkToggle" style="
      background:rgba(45,152,253,.1);border:none;cursor:pointer;
      padding:4px 8px;border-radius:8px;color:#2d98fd;
      font-size:.78rem;font-family:inherit;transition:.2s;"
      title="Toggle dark mode">🌙</button>
  `;
  document.body.appendChild(bar);

  document.getElementById('_cymDarkToggle').onclick = () => {
    const on = localStorage.getItem('cymDark') !== '1';
    localStorage.setItem('cymDark', on ? '1' : '0');
    applyDark();
    document.getElementById('_cymDarkToggle').textContent = on ? '☀️' : '🌙';
    // notify parent iframe (main site)
    try { window.parent.postMessage({ cymDark: on ? '1' : '0' }, '*'); } catch(e) {}
  };

  /* ── Load Firebase if not already loaded ── */
  function ensureFirebase(cb) {
    if (typeof firebase !== 'undefined' && firebase.auth) { cb(); return; }
    const sdks = [
      'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
    ];
    let loaded = 0;
    sdks.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { if (++loaded === sdks.length) cb(); };
      document.head.appendChild(s);
    });
  }

  ensureFirebase(() => {
    // init only if not already initialised
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyDYwO0SAoHcg076PnCGMGaAmvHfwPl6-n4",
        authDomain: "project-management-man2.firebaseapp.com",
        databaseURL: "https://project-management-man2-default-rtdb.firebaseio.com",
        projectId: "project-management-man2",
        storageBucket: "project-management-man2.firebasestorage.app",
        messagingSenderId: "731310432635",
        appId: "1:731310432635:web:d617c81ee9cd0122a49dde"
      });
    }

    firebase.auth().onAuthStateChanged(user => {
      if (!user) {
        const thisPage = encodeURIComponent(location.pathname + location.search);
        const fname    = encodeURIComponent(featureName);
        location.href  = `${redirectBase}?redirect=${thisPage}&feature=${fname}`;
        return;
      }

      // User is logged in — show bar
      const init = user.email[0].toUpperCase();
      const name = user.email.split('@')[0];
      document.getElementById('_cymUserDot').textContent  = init;
      document.getElementById('_cymUserName').textContent = name;
      bar.style.display = 'flex';

      // Logout
      document.getElementById('_cymLogout').onclick = () => {
        firebase.auth().signOut().then(() => {
          location.href = redirectBase + '?feature=' + encodeURIComponent(featureName);
        });
      };

      // expose globally so feature JS can use
      window.cymUser = user;

      // dispatch event so feature JS can react
      document.dispatchEvent(new CustomEvent('cymAuthReady', { detail: { user } }));
    });
  });
})();
