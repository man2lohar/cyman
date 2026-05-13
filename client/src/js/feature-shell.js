/**
 * feature-shell.js  v2 — CyManSquare Unified Header & Auth Guard
 *
 * MODE A (KMC pages with .header-section):
 *   Merges into ONE bar:  [Brand/] | [h1 + buttons] | [User/Dark/SignOut]
 *   Old logo-container is hidden. Old purple gradient is replaced.
 *
 * MODE B (PM and pages without .header-section):
 *   Injects a 48px glass top-bar + footer with legal links.
 */
(function () {
  'use strict';

  const script      = document.currentScript;
  const featureName = script.getAttribute('data-feature') || 'Feature';
  const loginPage   = script.getAttribute('data-login')   || 'login.html';
  const homeUrl     = script.getAttribute('data-home')    || '../../../../index.html';
  const scriptBase  = script.src.substring(0, script.src.lastIndexOf('/') + 1);
  const logoSrc     = new URL('../../public/assets/images/cymansquare_logo.svg', scriptBase).href;

  /* dark mode */
  const isDark = () => localStorage.getItem('cymDark') === '1';
  function applyDark(on) {
    document.documentElement.setAttribute('data-dark', on ? '1' : '0');
    document.body.classList.toggle('dark-mode', on);
    localStorage.setItem('cymDark', on ? '1' : '0');
    const ic = document.getElementById('_cymDarkIcon');
    if (ic) ic.innerHTML = on
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    const tip = document.getElementById('_cymDarkToggle');
    if (tip) tip.setAttribute('data-tip', on ? 'Light mode' : 'Dark mode');
    try { window.parent.postMessage({ cymDark: on ? '1' : '0' }, '*'); } catch(_) {}
  }
  applyDark(isDark());
  window.addEventListener('storage', e => { if (e.key === 'cymDark') applyDark(e.newValue === '1'); });

  /* ── inject CSS ── */
  const st = document.createElement('style');
  st.id = '_cymShellCss';
  st.textContent = `
  .logo-container{display:none!important}
  .header-section{
    position:fixed!important;top:0!important;left:0!important;right:0!important;
    width:100%!important;max-width:100%!important;height:56px!important;
    z-index:9000!important;display:flex!important;align-items:center!important;
    justify-content:space-between!important;padding:0 20px!important;
    box-sizing:border-box!important;gap:12px!important;border-radius:0!important;
    background:rgba(13,17,23,.92)!important;
    backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;
    border-bottom:1px solid rgba(45,152,253,.3)!important;
    box-shadow:0 2px 24px rgba(0,0,0,.4),0 0 0 1px rgba(45,152,253,.1)!important;
  }
  .header-section::after{
    content:''!important;position:absolute!important;bottom:0!important;
    left:0!important;right:0!important;height:1px!important;
    background:linear-gradient(90deg,transparent,#2d98fd 40%,#2d98fd 60%,transparent)!important;
    opacity:.5!important;pointer-events:none!important;
  }
  body:not(.dark-mode) .header-section{
    background:rgba(255,255,255,.9)!important;
    border-bottom:1px solid rgba(45,152,253,.2)!important;
    box-shadow:0 2px 20px rgba(0,0,0,.08)!important;
  }
  ._cym-brand{display:flex!important;align-items:center!important;gap:8px!important;
    text-decoration:none!important;flex-shrink:0!important;white-space:nowrap!important}
  ._cym-brand img{height:22px!important}
  ._cym-brand-name{font-family:'Akaya Kanadaka',cursive!important;font-size:1rem!important;
    font-weight:100!important;color:#2d98fd!important}
  ._cym-sep{color:rgba(45,152,253,.4)!important;font-size:.85rem!important;margin:0 2px!important}
  ._cym-center{display:flex!important;align-items:center!important;gap:10px!important;
    flex:1!important;justify-content:center!important;overflow:hidden!important}
  .header-section h1{margin:0!important;font-size:.95rem!important;font-weight:700!important;
    white-space:nowrap!important;color:#fff!important}
  body:not(.dark-mode) .header-section h1{color:#1c1f2e!important}
  .header-section .back-button,.header-section button.back-button{
    background:rgba(45,152,253,.14)!important;color:#2d98fd!important;
    border:1px solid rgba(45,152,253,.32)!important;border-radius:8px!important;
    padding:5px 12px!important;font-size:.75rem!important;font-weight:700!important;
    cursor:pointer!important;font-family:'Plus Jakarta Sans',sans-serif!important;white-space:nowrap!important}
  .header-section .back-button:hover{background:rgba(45,152,253,.28)!important;transform:translateY(-1px)!important}
  .header-section .clear-button{
    background:rgba(231,76,60,.14)!important;color:#e74c3c!important;
    border:1px solid rgba(231,76,60,.32)!important;border-radius:8px!important;
    padding:5px 12px!important;font-size:.75rem!important;font-weight:700!important;
    cursor:pointer!important;font-family:'Plus Jakarta Sans',sans-serif!important;white-space:nowrap!important}
  .header-section .clear-button:hover{background:rgba(231,76,60,.28)!important}
  .header-section .custom-file-upload{
    background:rgba(45,152,253,.14)!important;color:#2d98fd!important;
    border:1px solid rgba(45,152,253,.32)!important;border-radius:8px!important;
    padding:5px 12px!important;font-size:.75rem!important;font-weight:700!important;
    cursor:pointer!important;font-family:'Plus Jakarta Sans',sans-serif!important;white-space:nowrap!important}
  .header-section .custom-file-upload:hover{background:rgba(45,152,253,.28)!important}
  ._cym-right{display:flex!important;align-items:center!important;gap:8px!important;flex-shrink:0!important}
  ._cym-avatar{width:30px!important;height:30px!important;border-radius:50%!important;
    background:linear-gradient(135deg,#2d98fd,#1a7edf)!important;color:#fff!important;
    display:flex!important;align-items:center!important;justify-content:center!important;
    font-weight:800!important;font-size:.8rem!important;flex-shrink:0!important;
    overflow:hidden!important;box-shadow:0 2px 8px rgba(45,152,253,.4)!important}
  ._cym-avatar img{width:100%!important;height:100%!important;object-fit:cover!important}
  ._cym-username{font-size:.75rem!important;font-weight:600!important;
    color:rgba(255,255,255,.85)!important;white-space:nowrap!important;
    max-width:100px!important;overflow:hidden!important;text-overflow:ellipsis!important}
  body:not(.dark-mode) ._cym-username{color:#1c1f2e!important}
  ._cym-ctrl-btn{background:none!important;border:none!important;cursor:pointer!important;
    padding:4px 8px!important;border-radius:7px!important;font-size:.72rem!important;
    font-weight:700!important;font-family:inherit!important;
    color:rgba(255,255,255,.75)!important;transition:background .2s!important;white-space:nowrap!important}
  body:not(.dark-mode) ._cym-ctrl-btn{color:#1c1f2e!important}
  ._cym-ctrl-btn:hover{background:rgba(45,152,253,.2)!important;color:#2d98fd!important}
  ._cym-signout-btn{color:rgba(241, 52, 31, 0.96)!important}
  ._cym-signout-btn:hover{background:rgba(231,76,60,.15)!important;color:#e74c3c!important}
  ._cym-ctrl-btn{position:relative!important}
  ._cym-ctrl-btn::after{
    content:attr(data-tip)!important;position:absolute!important;
    bottom:-32px!important;left:50%!important;transform:translateX(-50%)!important;
    background:#1c1f2e!important;color:#fff!important;font-size:11px!important;
    font-weight:500!important;padding:4px 8px!important;border-radius:6px!important;
    white-space:nowrap!important;pointer-events:none!important;
    opacity:0!important;transition:opacity .15s!important;z-index:99999!important}
  ._cym-ctrl-btn:hover::after{opacity:1!important}
  #_cymShellBar{
    position:fixed!important;top:0!important;left:0!important;right:0!important;
    z-index:9999!important;height:48px!important;
    display:flex!important;align-items:center!important;justify-content:space-between!important;
    padding:0 20px!important;background:rgba(255,255,255,.9)!important;
    backdrop-filter:blur(18px)!important;border-bottom:1px solid rgba(0,0,0,.07)!important;
    box-shadow:0 2px 12px rgba(0,0,0,.06)!important;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif!important}
  [data-dark="1"] #_cymShellBar{background:rgba(13,17,23,.92)!important;border-color:rgba(255,255,255,.06)!important}
  [data-dark="1"] ._cym-username{color:#e8eaf6!important}
  [data-dark="1"] #_cymShellBar ._cym-ctrl-btn{color:#e8eaf6!important}
  #_cymShellFooter{text-align:center;padding:16px 20px;font-size:.7rem;font-weight:500;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    border-top:1px solid rgba(0,0,0,.07);color:#6b7499}
  [data-dark="1"] #_cymShellFooter{border-color:rgba(255,255,255,.06);color:#8892b0}
  #_cymShellFooter a{color:#2d98fd;text-decoration:none}
  #_cymShellFooter a:hover{text-decoration:underline}
  `;
  document.head.appendChild(st);

  /* helpers */
  function buildBrand() {
    return `<a class="_cym-brand" href="${homeUrl}" title="CyManSquare">
      <img src="${logoSrc}" alt="" onerror="this.style.display='none'">
      <span class="_cym-brand-name">CyMan²</span>
    </a><span class="_cym-sep">/</span>`;
  }
  function buildUser(user) {
    const init = (user.displayName||user.email||'U')[0].toUpperCase();
    const name = user.displayName||user.email.split('@')[0];
    const av   = user.photoURL ? `<img src="${user.photoURL}" alt="${init}">` : init;
    return `<div class="_cym-avatar" id="_cymAvatar">${av}</div>
      <span class="_cym-username">${name}</span>
      <button class="_cym-ctrl-btn" id="_cymDarkToggle" data-tip="${isDark()?'Light mode':'Dark mode'}">
        <span id="_cymDarkIcon">
          ${isDark()
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
          }
        </span>
      </button>
      <button class="_cym-ctrl-btn _cym-signout-btn" id="_cymSignOut" data-tip="Sign out">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>`;
  }
  function bindCtrl() {
    const d = document.getElementById('_cymDarkToggle');
    const o = document.getElementById('_cymSignOut');
    if (d) d.onclick = () => applyDark(!isDark());
    if (o) o.onclick = () => firebase.auth().signOut().then(() => {
      location.href = `${loginPage}?feature=${encodeURIComponent(featureName)}`;
    });
  }

  /* MODE A — merge into .header-section */
  function modeA(user) {
    const hdr = document.querySelector('.header-section');
    if (!hdr) return false;
    /* remove old logo-container */
    const old = hdr.querySelector('.logo-container');
    if (old) old.remove();
    /* wrap remaining children in center div */
    const cen = document.createElement('div');
    cen.className = '_cym-center';
    while (hdr.firstChild) cen.appendChild(hdr.firstChild);
    /* build left + right */
    const L = document.createElement('div');
    L.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0';
    L.innerHTML = buildBrand();
    const R = document.createElement('div');
    R.className = '_cym-right';
    R.innerHTML = buildUser(user);
    hdr.appendChild(L); hdr.appendChild(cen); hdr.appendChild(R);
    bindCtrl();
    return true;
  }

  /* MODE B — standalone bar */
  function modeB(user) {
    const bar = document.createElement('div');
    bar.id = '_cymShellBar';
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px">${buildBrand()}
        <span style="font-size:.78rem;font-weight:600;opacity:.5">${featureName}</span>
      </div>
      <div class="_cym-right">${buildUser(user)}</div>`;
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.style.paddingTop = '48px';
    const foot = document.createElement('div');
    foot.id = '_cymShellFooter';
    foot.innerHTML = `© 2026 CyManSquare &nbsp;·&nbsp;
      <a href="${homeUrl}">Home</a> &nbsp;·&nbsp;
      <a href="${homeUrl.replace('index.html','client/src/pages/privacy_policy.html')}">Privacy Policy</a> &nbsp;·&nbsp;
      <a href="${homeUrl.replace('index.html','client/src/pages/terms_of_service.html')}">Terms of Service</a> &nbsp;·&nbsp;
      <a href="${homeUrl.replace('index.html','client/src/pages/cookie_policy.html')}">Cookie Policy</a>`;
    document.body.appendChild(foot);
    bindCtrl();
  }

  /* Firebase auth + inject */
  function loadScript(src, cb) { const s=document.createElement('script'); s.src=src; s.onload=cb; document.head.appendChild(s); }

  function initAuth() {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey:'AIzaSyDYwO0SAoHcg076PnCGMGaAmvHfwPl6-n4',
        authDomain:'project-management-man2.firebaseapp.com',
        databaseURL:'https://project-management-man2-default-rtdb.firebaseio.com',
        projectId:'project-management-man2',
        storageBucket:'project-management-man2.appspot.com',
        messagingSenderId:'731310432635',
        appId:'1:731310432635:web:d617c81ee9cd0122a49dde'
      });
    }
    firebase.auth().onAuthStateChanged(user => {
      if (!user) {
        location.href = `${loginPage}?redirect=${encodeURIComponent(location.pathname+location.search)}&feature=${encodeURIComponent(featureName)}`;
        return;
      }
      window.cymUser = user;
      function inject() {
        if (!modeA(user)) modeB(user);
        document.dispatchEvent(new CustomEvent('cymAuthReady', { detail: { user } }));
      }
      document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', inject)
        : inject();
    });
  }

  typeof firebase !== 'undefined' && typeof firebase.auth === 'function'
    ? initAuth()
    : loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js', () =>
        loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js', initAuth));
})();
