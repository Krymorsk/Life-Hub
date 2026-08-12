import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithCredential,
  linkWithPopup
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCO-ZhC9cNxDXLeGSADrV1A-PiS8dq-MFY",
  authDomain: "life-hub-50fa9.firebaseapp.com",
  projectId: "life-hub-50fa9",
  storageBucket: "life-hub-50fa9.firebasestorage.app",
  messagingSenderId: "451759857601",
  appId: "1:451759857601:web:6248619e4b99e31e945940",
  measurementId: "G-PGKN3BXFVC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = s => document.querySelector(s);

let mode = "signin";
let anonymousUser = null;
let redirectBusy = false;

function setStatus(message, kind="error"){
  const el=$("#status");
  el.textContent=message||"";
  el.className=`status ${message ? kind : ""}`;
}

function firebaseMessage(error){
  const code=error?.code||"";
  const messages={
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/invalid-email":"That email address is not valid.",
    "auth/email-already-in-use":"That email already has a Life Hub account. Use Sign in instead.",
    "auth/weak-password":"Choose a stronger password with at least 6 characters.",
    "auth/operation-not-allowed":"This sign-in method is not enabled in Firebase Console.",
    "auth/popup-closed-by-user":"The Google sign-in window was closed.",
    "auth/popup-blocked":"Your browser blocked the Google sign-in popup.",
    "auth/network-request-failed":"Firebase could not reach the network.",
    "auth/unauthorized-domain":"This domain is not authorized in Firebase Authentication.",
    "auth/account-exists-with-different-credential":"That email already uses another sign-in method.",
    "auth/credential-already-in-use":"That credential already belongs to another account.",
    "auth/too-many-requests":"Too many attempts. Wait a moment and try again."
  };
  return messages[code]||error?.message||"Authentication failed. Please try again.";
}

function setSession(user){
  localStorage.setItem("lifehub_auth_completed","1");
  localStorage.setItem("lifehub_auth_provider",
    user?.isAnonymous ? "anonymous" : (user?.providerData?.[0]?.providerId || "account"));
  location.replace("index.html");
}

function setMode(next){
  mode=next;
  const creating=mode==="create";
  $("#signInMode").classList.toggle("active",!creating);
  $("#createMode").classList.toggle("active",creating);
  $("#loginTitle").textContent=creating?"Create your Life Hub.":"Welcome back.";
  $("#loginLead").textContent=creating
    ?"Create an account to keep your Life Hub synced across devices."
    :"Sign in to keep your Life Hub synced across your devices.";
  $("#emailSubmit").textContent=creating?"Create account":"Sign in with email";
  $("#password").autocomplete=creating?"new-password":"current-password";
  $("#forgotBtn").style.display=creating?"none":"block";
}

async function signInEmail(){
  const email=$("#email").value.trim();
  const password=$("#password").value;
  if(!email || !password){ setStatus("Enter your email and password."); return; }
  setStatus("Signing in…","success");
  try{
    const result=await signInWithEmailAndPassword(auth,email,password);
    setStatus("Signed in. Opening Life Hub…","success");
    setSession(result.user);
  }catch(error){
    setStatus(firebaseMessage(error));
  }
}

async function createEmail(){
  const email=$("#email").value.trim();
  const password=$("#password").value;
  if(!email || password.length<6){
    setStatus("Use a valid email and a password with at least 6 characters.");
    return;
  }

  setStatus("Creating your account…","success");
  try{
    // If this browser already has an anonymous Life Hub user, link the
    // permanent credential instead of creating a separate account.
    if(anonymousUser && anonymousUser.isAnonymous){
      const credential = await import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js")
        .then(({EmailAuthProvider})=>EmailAuthProvider.credential(email,password));
      const result=await linkWithCredential(anonymousUser,credential);
      setStatus("Your guest Life Hub is now secured.","success");
      setSession(result.user);
      return;
    }

    const result=await createUserWithEmailAndPassword(auth,email,password);
    setStatus("Account created. Opening Life Hub…","success");
    setSession(result.user);
  }catch(error){
    setStatus(firebaseMessage(error));
  }
}

async function googleAuth(){
  setStatus("Opening Google…","success");
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({prompt:"select_account"});
  try{
    if(anonymousUser && anonymousUser.isAnonymous){
      const result=await linkWithPopup(anonymousUser,provider);
      setStatus("Your guest Life Hub is now secured.","success");
      setSession(result.user);
      return;
    }
    const result=await signInWithPopup(auth,provider);
    setSession(result.user);
  }catch(error){
    // Mobile browsers can be better served by redirect.
    if(error?.code==="auth/popup-blocked"){
      try{
        await signInWithRedirect(auth,provider);
        return;
      }catch(redirectError){
        setStatus(firebaseMessage(redirectError));
        return;
      }
    }
    setStatus(firebaseMessage(error));
  }
}

async function guest(){
  setStatus("Starting a guest Life Hub…","success");
  try{
    const result=await signInAnonymously(auth);
    setSession(result.user);
  }catch(error){
    setStatus(firebaseMessage(error));
  }
}

async function forgot(){
  const email=$("#email").value.trim();
  if(!email){ setStatus("Enter your email first."); return; }
  try{
    await sendPasswordResetEmail(auth,email);
    setStatus("Password reset email sent.","success");
  }catch(error){
    setStatus(firebaseMessage(error));
  }
}

$("#signInMode").onclick=()=>setMode("signin");
$("#createMode").onclick=()=>setMode("create");
$("#authForm").onsubmit=e=>{
  e.preventDefault();
  mode==="create"?createEmail():signInEmail();
};
$("#googleBtn").onclick=googleAuth;
$("#guestBtn").onclick=guest;
$("#forgotBtn").onclick=forgot;

// If Google redirect returned, process it before normal routing.
getRedirectResult(auth).then(result=>{
  if(result?.user) setSession(result.user);
}).catch(error=>{
  if(error?.code) setStatus(firebaseMessage(error));
});

onAuthStateChanged(auth,user=>{
  anonymousUser=user?.isAnonymous?user:null;
  const completed=localStorage.getItem("lifehub_auth_completed")==="1";
  // Don't redirect automatically for an anonymous user: show the login page
  // so they can explicitly secure or continue as guest.
  if(user && !user.isAnonymous && completed && !redirectBusy){
    redirectBusy=true;
    setSession(user);
  }
});

setMode("signin");
