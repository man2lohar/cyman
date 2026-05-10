(function () {
  var RELEASE_DATE = new Date('2026-05-09'); // ← change to your release date
  var WEEK_MS      = 7 * 24 * 60 * 60 * 1000;
  /* remove this comment for real use, it's just for testing to always show the popup 
  var SEEN_KEY = 'kmc-dxf-feature-seen-test-' + Date.now(); // temp: always fresh
  */
  var SEEN_KEY = 'kmc-dxf-feature-seen'; // ← change to a stable key for real use

  function dismiss() {
    localStorage.setItem(SEEN_KEY, '1');
    var p = document.getElementById('kmc-whats-new-popup');
    if (p) p.style.display = 'none';
  }

  function createPopup() {
    var el = document.createElement('div');
    el.id = 'kmc-whats-new-popup';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;';
    el.innerHTML = `
  <div style="background:var(--surface);border-radius:20px;max-width:500px;width:92%;overflow:hidden;border:0.5px solid rgba(255,255,255,.08);">

    <div style="background:#0f172a;padding:32px 28px 24px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(45,152,253,.12);"></div>
      <div style="position:absolute;bottom:-40px;left:60px;width:120px;height:120px;border-radius:50%;background:rgba(26,153,212,.08);"></div>
      <button id="kmc-wn-close" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.1);border:0.5px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);border-radius:8px;width:30px;height:30px;font-size:18px;cursor:pointer;z-index:2;">&times;</button>
      <div style="display:flex;align-items:center;gap:16px;position:relative;z-index:1;">
        <div style="flex-shrink:0;">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <rect width="72" height="72" rx="18" fill="rgba(45,152,253,0.15)"/>
            <rect x="1" y="1" width="70" height="70" rx="17" stroke="rgba(45,152,253,0.4)" stroke-width="1"/>
            <polygon points="36,12 14,42 32,42 30,60 58,30 40,30 36,12" fill="rgba(45,152,253,0.15)" stroke="#2d98fd" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="36" cy="36" r="6" fill="rgba(45,152,253,0.3)" stroke="#2d98fd" stroke-width="1.5"/>
            <line x1="20" y1="20" x2="14" y2="14" stroke="#2d98fd" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="52" y1="20" x2="58" y2="14" stroke="#2d98fd" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <line x1="36" y1="8" x2="36" y2="2" stroke="#2d98fd" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            <circle cx="14" cy="13" r="2" fill="#2d98fd" opacity="0.6"/>
            <circle cx="58" cy="13" r="2" fill="#2d98fd" opacity="0.6"/>
            <circle cx="36" cy="2" r="2" fill="#2d98fd" opacity="0.6"/>
          </svg>
        </div>
        <div>
          <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(45,152,253,.2);border:0.5px solid rgba(45,152,253,.4);border-radius:20px;padding:3px 10px;margin-bottom:8px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#2d98fd;display:inline-block;"></span>
            <span style="font-size:11px;font-weight:600;color:#2d98fd;letter-spacing:.06em;text-transform:uppercase;">New Feature</span>
          </div>
          <div style="color:#fff;font-size:22px;font-weight:700;line-height:1.2;">Area from AutoCAD Drawings</div>
          <div style="color:rgba(255,255,255,.5);font-size:13px;margin-top:4px;">Upload drawings, skip the spreadsheet</div>
        </div>
      </div>
    </div>

    <div style="padding:24px 28px;background:var(--bg2,#f8f9fa)">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
        <div style="background:var(--bg2,#f8f9fa);border-radius:12px;padding:14px 12px;text-align:center;border:1px solid var(--border,#eee);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a99d4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div style="font-size:12px;font-weight:600;color:var(--text,#111);">DXF files</div>
          <div style="font-size:11px;color:var(--muted,#888);margin-top:2px;">Direct upload</div>
        </div>
        <div style="background:var(--bg2,#f8f9fa);border-radius:12px;padding:14px 12px;text-align:center;border:1px solid var(--border,#eee);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d9e75" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <div style="font-size:12px;font-weight:600;color:var(--text,#111);">Auto extract</div>
          <div style="font-size:11px;color:var(--muted,#888);margin-top:2px;">Layers + areas</div>
        </div>
        <div style="background:var(--bg2,#f8f9fa);border-radius:12px;padding:14px 12px;text-align:center;border:1px solid var(--border,#eee);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ba7517" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px;display:block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size:12px;font-weight:600;color:var(--text,#111);">Saves time</div>
          <div style="font-size:11px;color:var(--muted,#888);margin-top:2px;">No conversion</div>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(26,153,212,.06);border:1px solid rgba(26,153,212,.25);border-radius:10px;padding:12px 14px;margin-bottom:20px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a99d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style="font-size:13px;color:var(--muted,#555);line-height:1.5;">Find it on the <strong style="color:var(--text,#111);">Home tab</strong> under <strong style="color:var(--text,#111);">"DXF Layer Extractor"</strong> — works alongside your existing Excel upload.</span>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;">
        <button id="kmc-wn-dismiss" style="padding:9px 18px;border-radius:8px;border:1px solid var(--border2,#ccc);background:transparent;color:var(--muted,#666);font-size:13px;font-weight:500;cursor:pointer;">Don't show again</button>
        <button id="kmc-wn-gotit" style="padding:9px 22px;border-radius:8px;border:none;background:#1a99d4;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">Got it <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
      </div>
    </div>
  </div>
`;
    document.body.appendChild(el);

    document.getElementById('kmc-wn-close').addEventListener('click', dismiss);
    document.getElementById('kmc-wn-dismiss').addEventListener('click', dismiss);
    document.getElementById('kmc-wn-gotit').addEventListener('click', dismiss);
  }

  function init() {
    var expired  = (Date.now() - RELEASE_DATE.getTime()) > WEEK_MS;
    var seen     = localStorage.getItem(SEEN_KEY) === '1';
    if (seen || expired) return;

    createPopup();
    setTimeout(function () {
      var p = document.getElementById('kmc-whats-new-popup');
      if (p) p.style.display = 'flex';
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();