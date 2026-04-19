(function () {
  // --- Firebase Config ---
  const firebaseConfig = {
    apiKey: "AIzaSyDYwO0SAoHcg076PnCGMGaAmvHfwPl6-n4",
    authDomain: "project-management-man2.firebaseapp.com",
    databaseURL: "https://project-management-man2-default-rtdb.firebaseio.com",
    projectId: "project-management-man2",
    storageBucket: "project-management-man2.firebasestorage.app",
    messagingSenderId: "731310432635",
    appId: "1:731310432635:web:d617c81ee9cd0122a49dde",
    measurementId: "G-NJFELXSRRP"
  };

  // Initialize Firebase
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const auth = firebase.auth();

  window.projects = [];
  window.tasks = [];
  window.trash = [];

  // --- Wait for login ---
  function waitForLogin() {
    return new Promise((resolve, reject) => {
      const unsub = auth.onAuthStateChanged(user => {
        unsub();
        if (user) resolve(user);
        else reject("Not logged in");
      });
    });
  }

  // --- User Reference ---
  function userRef(path) {
    const user = auth.currentUser;
    if (!user) return db.ref("public_error");
    return db.ref(`users/${user.uid}/${path}`);
  }

  // --- Generate Unique IDs ---
  function uid() {
    return "id-" + Math.random().toString(36).substr(2, 9);
  }

  // --- Normalize Old Data (string-based to object-based) ---
  function normalizeProjects(projArray) {
    if (!Array.isArray(projArray)) return [];
    return projArray.map(p => {
      if (typeof p === "string") return { id: uid(), name: p };
      if (p && typeof p === "object" && p.name) return p;
      return { id: uid(), name: "Untitled" };
    });
  }

  function normalizeTasks(taskArray, projects) {
    if (!Array.isArray(taskArray)) return [];
    const map = {};
    projects.forEach(p => (map[p.name] = p.id));
    return taskArray.map(t => {
      if (!t) return null;
      if (!t.projectId && t.project && map[t.project])
        t.projectId = map[t.project];
      return t;
    }).filter(Boolean);
  }

  // --- Load Projects ---
  window.loadProjects = (cb) => {
    waitForLogin().then(() => {
      userRef("projects").once("value").then(snapshot => {
        const val = snapshot.val() || [];
        window.projects = normalizeProjects(val);
        userRef("projects").set(window.projects); // ensure normalized
        cb?.(window.projects);
      });
    });
  };

  // --- Load Tasks ---
  window.loadTasks = (cb) => {
    waitForLogin().then(() => {
      userRef("tasks").once("value").then(snapshot => {
        const val = snapshot.val() || [];
        window.tasks = normalizeTasks(val, window.projects);
        userRef("tasks").set(window.tasks); // save normalized
        cb?.(window.tasks);
      });
    });
  };

  // --- Load Trash ---
  window.loadTrash = (cb) => {
    waitForLogin().then(() => {
      userRef("trash").once("value").then(snapshot => {
        window.trash = snapshot.val() || [];
        cb?.(window.trash);
      });
    });
  };

  // --- Save All ---
  window.saveProjects = () => {
    waitForLogin().then(() => userRef("projects").set(window.projects || []));
  };

  window.saveTasks = () => {
    waitForLogin().then(() => userRef("tasks").set(window.tasks || []));
  };

  window.saveTrash = () => {
    waitForLogin().then(() => userRef("trash").set(window.trash || []));
  };

  // --- Move Task to Trash ---
  window.moveToTrash = (taskIndex) => {
    if (!Array.isArray(window.tasks) || taskIndex < 0) return;
    const task = window.tasks.splice(taskIndex, 1)[0];
    if (!task) return;
    window.trash = window.trash || [];
    task.deletedAt = new Date().toISOString();
    window.trash.push(task);
    window.saveTasks();
    window.saveTrash();
  };

  // --- Restore Task from Trash ---
  window.restoreFromTrash = (trashIndex) => {
    if (!Array.isArray(window.trash) || trashIndex < 0) return;
    const task = window.trash.splice(trashIndex, 1)[0];
    if (!task) return;
    delete task.deletedAt;
    window.tasks = window.tasks || [];
    window.tasks.push(task);
    window.saveTasks();
    window.saveTrash();
  };

  // --- Delete Permanently ---
  window.deletePermanently = (trashIndex) => {
    if (!Array.isArray(window.trash) || trashIndex < 0) return;
    window.trash.splice(trashIndex, 1);
    window.saveTrash();
  };

  // --- Load All Data ---
  window.loadAllData = (cb) => {
    Promise.all([
      new Promise(res => loadProjects(res)),
      new Promise(res => loadTasks(res)),
      new Promise(res => loadTrash(res))
    ]).then(() => cb?.());
  };
})();
