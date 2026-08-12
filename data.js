import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

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

// Firestore's current persistent cache API keeps the app useful offline
// and synchronizes writes when connectivity returns.
const db = getFirestore(app);

const STORES = [
  "people","accounts","transactions","goals","projects","tasks","events",
  "habits","wishlist","notes","journal","documents","assets","subscriptions",
  "routines","lifePlans","tags","reminders","links","meta"
];


function firebaseError(error) {
  const code = error?.code || "";
  if (code === "permission-denied") return "Firestore Rules denied this write.";
  if (code === "unauthenticated") return "Firebase authentication is not active.";
  if (code === "failed-precondition") return "Firestore is not ready for this browser/session.";
  if (code === "unavailable") return "Firebase is temporarily unavailable.";
  if (code === "auth/operation-not-allowed") return "Anonymous Authentication is disabled.";
  return error?.message || "Firebase request failed.";
}

const SCHEMA = {
  version: 4,
  backend: "firebase-firestore",
  entities: STORES,
  relationships: [
    ["goal","project","has"],["project","task","has"],["goal","task","supports"],
    ["goal","transaction","funded-by"],["wishlist","goal","funded-by"],
    ["wishlist","transaction","purchased-as"],["person","event","attends"],
    ["person","note","about"],["person","journal","about"],["person","task","for"],
    ["task","event","scheduled-as"],["habit","goal","supports"],
    ["subscription","transaction","billed-as"],["asset","document","has"],
    ["lifePlan","goal","contains"],["reminder","task","reminds"]
  ]
};

let currentUser = null;
let authStateSeen = false;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (!authStateSeen) {
    authStateSeen = true;
    authReadyResolve(user || null);
  }
});

async function ensureAuth() {
  await authReady;
  if (currentUser) return currentUser;

  try {
    const credential = await signInAnonymously(auth);
    currentUser = credential.user;
    return currentUser;
  } catch (error) {
    console.error("Firebase anonymous auth failed:", error);
    const code = error?.code || "unknown";
    let message = "Firebase authentication failed.";
    if (code === "auth/operation-not-allowed") {
      message = "Anonymous Authentication is disabled in Firebase Console.";
    } else if (code === "auth/invalid-api-key") {
      message = "Firebase API key/config is invalid.";
    } else if (code === "auth/network-request-failed") {
      message = "Firebase authentication could not reach the network.";
    }
    throw Object.assign(new Error(message), { code });
  }
}

async function currentCollection(store) {
  const user = await ensureAuth();
  return collection(db, "users", user.uid, store);
}

async function all(store) {
  const ref = await currentCollection(store);
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function get(store, id) {
  const user = await ensureAuth();
  const ref = doc(db, "users", user.uid, store, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function create(store, item) {
  const user = await ensureAuth();
  const id = item.id || crypto.randomUUID();
  const ref = doc(db, "users", user.uid, store, id);
  const value = {
    ...item,
    id,
    createdAt: item.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, value, { merge: true });
  return { ...item, id };
}

async function remove(store, id) {
  const user = await ensureAuth();
  await deleteDoc(doc(db, "users", user.uid, store, id));
}

async function link(fromType, fromId, relation, toType, toId) {
  return create("links", {
    fromType, fromId, relation, toType, toId,
    linkKey: `${fromType}:${fromId}:${relation}:${toType}:${toId}`
  });
}

async function linksFor(type, id) {
  const rows = await all("links");
  return rows.filter(l =>
    (l.fromType === type && l.fromId === id) ||
    (l.toType === type && l.toId === id)
  );
}

async function getAllProjects() { return all("projects"); }

async function getUserProfile() {
  const user = await ensureAuth();
  return get("meta", "profile");
}

async function saveUserProfile(profile) {
  return create("meta", { id: "profile", ...profile });
}

async function deleteStoreRecord(store, id) {
  await remove(store, id);
}

async function getRelationshipsFor(type, id) {
  return linksFor(type, id);
}


async function loadState() {
  await ensureAuth();
  const [people,projects,goals,wishes,transactions,notes,journal,tasks,events,habits] =
    await Promise.all([
      all("people"), all("projects"), all("goals"), all("wishlist"),
      all("transactions"), all("notes"), all("journal"), all("tasks"),
      all("events"), all("habits")
    ]);

  const income = transactions.filter(x => x.type === "in")
    .reduce((sum,x) => sum + Number(x.amount || 0), 0);
  const expenses = transactions.filter(x => x.type === "out")
    .reduce((sum,x) => sum + Math.abs(Number(x.amount || 0)), 0);

  return {
    balance: income - expenses,
    people, projects, goals, wishes, transactions, notes, journal, tasks, events, habits
  };
}

async function persistState(state) {
  // Firestore is authoritative. Existing records have already been written
  // individually by create(); this pass safely reconciles in-memory records.
  const pairs = [
    ["people","people"],["projects","projects"],["goals","goals"],
    ["wishlist","wishes"],["transactions","transactions"],["notes","notes"],
    ["journal","journal"],["tasks","tasks"],["events","events"],["habits","habits"]
  ];

  for (const [store, key] of pairs) {
    const items = Array.isArray(state[key]) ? state[key] : [];
    if (!items.length) continue;
    const user = await ensureAuth();
    const batch = writeBatch(db);
    for (const item of items) {
      const id = item.id || crypto.randomUUID();
      batch.set(
        doc(db, "users", user.uid, store, id),
        { ...item, id, updatedAt: serverTimestamp(), createdAt: item.createdAt || serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  }
  return true;
}

async function exportAll() {
  const stores = {};
  for (const store of STORES) stores[store] = await all(store);
  return {
    format: "life-hub-firestore-backup",
    schemaVersion: SCHEMA.version,
    exportedAt: new Date().toISOString(),
    uid: currentUser?.uid || null,
    stores
  };
}

async function reset() {
  const user = await ensureAuth();
  for (const store of STORES) {
    const rows = await all(store);
    if (!rows.length) continue;
    const chunks = [];
    for (let i=0; i<rows.length; i+=400) chunks.push(rows.slice(i,i+400));
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(row => batch.delete(doc(db, "users", user.uid, store, row.id)));
      await batch.commit();
    }
  }
}

async function search(queryText) {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q) return [];
  const results = [];
  const searchable = [
    ["people","People"],["accounts","Accounts"],["transactions","Transactions"],
    ["goals","Goals"],["projects","Projects"],["tasks","Tasks"],["events","Events"],
    ["habits","Habits"],["wishlist","Wishlist"],["notes","Notes"],["journal","Journal"],
    ["documents","Documents"],["assets","Assets"],["subscriptions","Subscriptions"],
    ["lifePlans","Life Plans"],["reminders","Reminders"]
  ];

  for (const [store,label] of searchable) {
    const rows = await all(store);
    for (const record of rows) {
      const haystack = JSON.stringify(record).toLowerCase();
      if (!haystack.includes(q)) continue;
      const title = record.title || record.name || record.description || label;
      const subtitle = record.description || record.note || record.category || "";
      results.push({
        id: record.id,
        store,
        type: label,
        title: String(title).slice(0,100),
        subtitle: String(subtitle).slice(0,120)
      });
    }
  }
  return results.slice(0,60);
}

async function initialize() {
  await ensureAuth();
  return loadState();
}

export const LifeFirebase = { app, auth, db, firebaseError, getUser: () => currentUser };
export const LifeDB = {
  schema: SCHEMA,
  initialize, loadState, persistState, create, get, remove,
  linksFor, getAllProjects, getUserProfile, saveUserProfile,
  deleteStoreRecord, getRelationshipsFor, link, exportAll, reset, search, all
};

