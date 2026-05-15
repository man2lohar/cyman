(function () {
  /* ================================================================
     CyManSquare — db.js  (save-only version)
     
     app.js handles all Firebase READS directly with safeOnce().
     db.js only provides SAVE functions and trash operations so the
     loading chain is fully controlled and never hangs.
  ================================================================ */

  const firebaseConfig = {
    apiKey:            "AIzaSyDYwO0SAoHcg076PnCGMGaAmvHfwPl6-n4",
    authDomain:        "project-management-man2.firebaseapp.com",
    databaseURL:       "https://project-management-man2-default-rtdb.firebaseio.com",
    projectId:         "project-management-man2",
    storageBucket:     "project-management-man2.firebasestorage.app",
    messagingSenderId: "731310432635",
    appId:             "1:731310432635:web:d617c81ee9cd0122a49dde",
    measurementId:     "G-NJFELXSRRP"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db   = firebase.database();
  const auth = firebase.auth();

  /* Initialise globals so app.js never hits undefined */
  window.projects = window.projects || [];
  window.tasks    = window.tasks    || [];
  window.trash    = window.trash    || [];

  /* ── Helper: get a ref under the current user ── */
  function uref(path) {
    var user = auth.currentUser;
    if (!user) { console.warn('[db] uref: no currentUser for path:', path); return null; }
    return db.ref('users/' + user.uid + '/' + path);
  }

  /* ── Save helpers ── */
  function safeSave(path, data) {
    var ref = uref(path);
    if (!ref) return;
    ref.set(data || []).catch(function(e) { console.error('[db] save error on', path, e.message); });
  }

  window.saveProjects = function() { safeSave('projects', window.projects); };
  window.saveTasks    = function() { safeSave('tasks',    window.tasks);    };
  window.saveTrash    = function() { safeSave('trash',    window.trash);    };

  /* ── Trash operations ── */
  window.moveToTrash = function(taskIndex) {
    if (!Array.isArray(window.tasks) || taskIndex < 0 || taskIndex >= window.tasks.length) return;
    var task = window.tasks.splice(taskIndex, 1)[0];
    if (!task) return;
    task.deletedAt = new Date().toISOString();
    window.trash = window.trash || [];
    window.trash.push(task);
    window.saveTasks();
    window.saveTrash();
  };

  window.restoreFromTrash = function(trashIndex) {
    if (!Array.isArray(window.trash) || trashIndex < 0 || trashIndex >= window.trash.length) return;
    var task = window.trash.splice(trashIndex, 1)[0];
    if (!task) return;
    delete task.deletedAt;
    window.tasks = window.tasks || [];
    window.tasks.push(task);
    window.saveTasks();
    window.saveTrash();
  };

  window.deletePermanently = function(trashIndex) {
    if (!Array.isArray(window.trash) || trashIndex < 0 || trashIndex >= window.trash.length) return;
    window.trash.splice(trashIndex, 1);
    window.saveTrash();
  };

  /* ── Legacy stubs so nothing breaks if old code calls these ── */
  window.loadProjects = function(cb) { cb?.(window.projects); };
  window.loadTasks    = function(cb) { cb?.(window.tasks);    };
  window.loadTrash    = function(cb) { cb?.(window.trash);    };
  window.loadAllData  = function(cb) { cb?.();                };

})();
