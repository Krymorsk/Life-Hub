import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCO-ZhC9cNxDXLeGSADrV1A-PiS8dq-MFY",
  authDomain: "life-hub-50fa9.firebaseapp.com",
  projectId: "life-hub-50fa9",
  storageBucket: "life-hub-50fa9.firebasestorage.app",
  messagingSenderId: "451759857601",
  appId: "1:451759857601:web:6248619e4b99e31e945940",
  measurementId: "G-PGKN3BXFVC"
};

document.documentElement.classList.add("auth-checking");

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

let settled = false;
const finish = (authenticated) => {
  if (settled) return;
  settled = true;
  document.documentElement.classList.remove("auth-checking");
  if (!authenticated) {
    localStorage.removeItem("lifehub_auth_completed");
    location.replace("login.html");
  } else {
    localStorage.setItem("lifehub_auth_completed","1");
  }
};

const timeout = setTimeout(() => finish(false), 10000);

onAuthStateChanged(auth, user => {
  clearTimeout(timeout);
  finish(!!user && !user.isAnonymous);
});
