/* ==============================================================
   10base DT — FIREBASE CONFIG
   Pozor: index.html a login.html načítají firebase-app-compat.js /
   firebase-auth-compat.js / firebase-database-compat.js jako
   klasické <script> tagy (ne ES moduly), takže se používá
   globální `firebase.initializeApp(...)`, ne `import`.
================================================================== */

firebase.initializeApp({
  apiKey: "AIzaSyCtu-YVWSMu3diUQnONIf5OgRkYvf4dFiw",
  authDomain: "base-dev-201a8.firebaseapp.com",
  projectId: "base-dev-201a8",
  storageBucket: "base-dev-201a8.firebasestorage.app",
  messagingSenderId: "63666844773",
  appId: "1:63666844773:web:5548e7a96e01375089028c",
  // databaseURL: "https://base-dev-201a8-default-rtdb.<REGION>.firebasedatabase.app"
  // ↑ DOPLNIT — viz poznámka níž, bez tohohle window.db nepůjde
});

window.db = firebase.database();
