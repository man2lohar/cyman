<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
<script>
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
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  firebase.auth().onAuthStateChanged(user => {
    if (!user) window.location = "login.html";
  });
</script>
