/**
 * main.js
 * Main page logic for index.html
 * Requires: Firebase modular SDK loaded via <script type="module">
 * Exports window globals used by inline onclick handlers.
 */

import { initializeApp }                                          from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut,
         onAuthStateChanged }                                     from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue }                              from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ── Firebase init ───────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyDYwO0SAoHcg076PnCGMGaAmvHfwPl6-n4",
  authDomain:        "project-management-man2.firebaseapp.com",
  databaseURL:       "https://project-management-man2-default-rtdb.firebaseio.com",
  projectId:         "project-management-man2",
  storageBucket:     "project-management-man2.appspot.com",
  messagingSenderId: "731310432635",
  appId:             "1:731310432635:web:d617c81ee9cd0122a49dde"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

/* ── Slide navigation ────────────────────────────────────────── */
let currentIndex = 0;

window.slideTo = (index, el) => {
  currentIndex = index;
  document.getElementById('viewport').style.transform = `translateX(-${index * 100}vw)`;
  document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('progressFill').style.width = `${((index + 1) / 6) * 100}%`;
  updateBg();
};

function updateBg() {
  const dark = document.body.classList.contains('dark-mode');
  const lc   = ['#F9F7F2','#FFF9F0','#F2F6F9','#F9F2F2','#F2F9F4','#F7F2F9'];
  const dc   = ['#0f1117','#151a22','#101520','#150f17','#0f1a14','#17111a'];
  document.getElementById('body').style.backgroundColor = dark ? dc[currentIndex] : lc[currentIndex];
}

/* ── Dark mode ───────────────────────────────────────────────── */
window.toggleDarkMode = () => {
  const on = !document.body.classList.contains('dark-mode');
  document.body.classList.toggle('dark-mode', on);
  localStorage.setItem('cymDark', on ? '1' : '0');
  updateBg();
  // sync to any open feature iframes
  try { window.frames[0]?.postMessage({ cymDark: on ? '1' : '0' }, '*'); } catch(_) {}
};

// On load: apply stored preference
if (localStorage.getItem('cymDark') === '1') {
  document.body.classList.add('dark-mode');
}
updateBg();

/* ── Auth modal ──────────────────────────────────────────────── */
window.toggleModal = () => {
  document.getElementById('authOverlay').classList.toggle('active');
};

/* ── "Get Started" button: open dashboard if logged in ──────── */
window.getStarted = () => {
  if (auth.currentUser) {
    window.openDashboard();
  } else {
    window.toggleModal();
  }
};

/* ── Dashboard open/close ────────────────────────────────────── */
window.openDashboard = () => {
  document.getElementById('dashboardOverlay').classList.add('active');
  document.getElementById('authOverlay').classList.remove('active');
};
window.closeDashboard = () => {
  document.getElementById('dashboardOverlay').classList.remove('active');
};

/* ── Open feature in new tab ─────────────────────────────────── */
window.openFeature = (title, url) => {
  if (!auth.currentUser) {
    // Not logged in: show login
    window.toggleModal();
    return;
  }
  window.open(url, '_blank');
};

/* ── Auth state listener ─────────────────────────────────────── */
let isLoginMode  = true;

onAuthStateChanged(auth, user => {
  const ag = document.getElementById('authGroup');
  if (user) {
    const init = (user.displayName || user.email)[0].toUpperCase();
    ag.innerHTML = `<div class="profile-trigger" onclick="openDashboard()" title="Open Dashboard">
      ${user.photoURL
        ? `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : init}
    </div>`;
    if (typeof window.onDashboardUserReady === 'function') {
      window.onDashboardUserReady(user, db);
    }
  } else {
    ag.innerHTML = `<a class="auth-link" onclick="toggleModal()">Log In</a>`;
  }
});

/* ── Auth form submit ────────────────────────────────────────── */
document.getElementById('authForm').onsubmit = async e => {
  e.preventDefault();
  const err    = document.getElementById('errorDisplay');
  const btn    = document.getElementById('submitBtn');
  const loader = document.getElementById('btnLoader');
  const arrow  = document.getElementById('btnArrow');
  const text   = document.getElementById('btnText');
  err.style.display = 'none';
  btn.classList.add('loading');
  loader.style.display = 'block';
  arrow.style.display  = 'none';
  text.style.opacity   = '.5';

  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const friendly = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password. Try again.',
    'auth/invalid-email':        'Invalid email address.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/too-many-requests':    'Too many attempts. Please wait.',
    'auth/invalid-credential':   'Incorrect email or password.',
  };

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
    document.getElementById('authOverlay').classList.remove('active');
    window.openDashboard();
  } catch (error) {
    err.style.display = 'flex';
    err.querySelector('span') && (err.querySelector('span').textContent = friendly[error.code] || error.message);
  } finally {
    btn.classList.remove('loading');
    loader.style.display = 'none';
    arrow.style.display  = 'block';
    text.style.opacity   = '1';
  }
};

/* Forgot password link in auth modal */
const forgotEl = document.getElementById('forgotPasswordLink');
if (forgotEl) {
  forgotEl.onclick = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!email) { alert('Please enter your email first.'); return; }
    try {
      const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent! Check your inbox.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
}

/* ── Toggle login / register ─────────────────────────────────── */
document.getElementById('switchAuth').onclick = () => {
  isLoginMode = !isLoginMode;
  const ng = document.getElementById('nameGroup');
  const fl = document.getElementById('forgotPasswordLink');
  document.getElementById('modalTitle').innerText    = isLoginMode ? 'Welcome back'              : 'Create account';
  document.getElementById('modalSubtitle').innerText = isLoginMode ? 'Sign in to your workspace' : 'Start your free trial today';
  document.getElementById('btnText').innerText       = isLoginMode ? 'Continue'                  : 'Create Account';
  document.getElementById('switchAuth').innerHTML    = isLoginMode
    ? "Don't have an account? <span>Register</span>"
    : "Already have an account? <span>Sign In</span>";
  if (ng) ng.style.display = isLoginMode ? 'none' : 'block';
  if (fl) fl.style.display = isLoginMode ? 'block' : 'none';
};

/* ── Password eye toggle ─────────────────────────────────────── */
window.togglePassword = () => {
  const p = document.getElementById('password');
  p.type  = p.type === 'password' ? 'text' : 'password';
};

/* ── Logout ──────────────────────────────────────────────────── */
window.handleLogout = () => {
  signOut(auth);
  window.closeDashboard();
};

/* ── SVG background builder ──────────────────────────────────── */
(function buildBg() {
  const glg = document.getElementById('gridLines');
  const geo = document.getElementById('geoShapes');
  if (!glg || !geo) return;
  const W = window.innerWidth, H = window.innerHeight;
  const ns = 'http://www.w3.org/2000/svg';
  function line(x1,y1,x2,y2,op){
    const l=document.createElementNS(ns,'line');
    [['x1',x1],['y1',y1],['x2',x2],['y2',y2],
     ['stroke','currentColor'],['stroke-opacity',op]].forEach(([k,v])=>l.setAttribute(k,v));
    return l;
  }
  for(let x=0;x<W;x+=80) glg.appendChild(line(x,0,x,H,'.04'));
  for(let y=0;y<H;y+=80) glg.appendChild(line(0,y,W,y,'.04'));
  const shapes = [
    {type:'polygon',points:`${W*.14},${H*.08} ${W*.26},${H*.04} ${W*.3},${H*.18} ${W*.18},${H*.22}`,op:.07},
    {type:'circle', cx:W*.84, cy:H*.17, r:85, op:.05},
    {type:'polygon',points:`${W*.7},${H*.72} ${W*.84},${H*.66} ${W*.9},${H*.82} ${W*.73},${H*.86}`,op:.06},
    {type:'circle', cx:W*.1,  cy:H*.76, r:55, op:.05},
  ];
  shapes.forEach(s=>{
    const el=document.createElementNS(ns,s.type);
    if(s.type==='polygon') el.setAttribute('points',s.points);
    if(s.type==='circle'){el.setAttribute('cx',s.cx);el.setAttribute('cy',s.cy);el.setAttribute('r',s.r);}
    el.setAttribute('stroke','currentColor');
    el.setAttribute('stroke-opacity',s.op);
    el.setAttribute('fill','none');
    el.setAttribute('stroke-width','1.5');
    el.classList.add('geo-anim');
    geo.appendChild(el);
  });
  for(let i=0;i<5;i++){
    const c=document.createElementNS(ns,'circle');
    c.setAttribute('cx',Math.random()*W);
    c.setAttribute('cy',Math.random()*H);
    c.setAttribute('r',20+Math.random()*55);
    c.setAttribute('stroke','currentColor');
    c.setAttribute('stroke-opacity','.04');
    c.setAttribute('fill','none');
    c.setAttribute('stroke-dasharray','4 6');
    c.style.animation=`drift ${8+i*2}s ease-in-out infinite alternate`;
    c.style.animationDelay=`${i*1.1}s`;
    geo.appendChild(c);
  }
})();

/* ── Typing effect ───────────────────────────────────────────── */
(function typewriter() {
  const lines = [
    'Architecture & Design Tools',
    'Powered by AI & Data',
    'Built for the Future',
    'KMC Municipal Data — Fast'
  ];
  let li=0, ci=0, del=false;
  const el = document.getElementById('typingText');
  if (!el) return;
  function type() {
    const line = lines[li];
    if (!del) {
      el.textContent = line.slice(0, ++ci);
      if (ci === line.length) { del = true; setTimeout(type, 1800); return; }
    } else {
      el.textContent = line.slice(0, --ci);
      if (ci === 0) { del = false; li = (li+1) % lines.length; }
    }
    setTimeout(type, del ? 40 : 70);
  }
  type();
})();

/* ── Support form submit (EmailJS) ───────────────────────────── */
const supportForm = document.getElementById('supportFormMain');
if (supportForm) {
  supportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = supportForm.querySelector('[type=submit]');
    const orig = btn.textContent;
    btn.textContent  = 'Sending…';
    btn.disabled     = true;

    const data = Object.fromEntries(new FormData(supportForm).entries());
    try {
      // EmailJS — replace YOUR_SERVICE_ID and YOUR_TEMPLATE_ID after setup
      await emailjs.send('service_issffxa', 'template_1y8saho', {
        from_name:    data.first_name + ' ' + data.last_name,
        from_email:   data.email,
        category:     data.category,
        message:      data.message,
        to_email:     'cymansquare@outlook.com'
      });
      btn.textContent = '✓ Sent!';
      supportForm.reset();
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
    } catch(err) {
      btn.textContent = 'Failed – try again';
      btn.disabled    = false;
      console.error('EmailJS error:', err);
    }
  });
}
