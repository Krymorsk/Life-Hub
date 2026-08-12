const CACHE="life-hub-v24-login";
const ASSETS=["./","./index.html","./login.html","./login.css","./auth-gate.js","./style.css","./data.js?v=24","./script.js?v=24","./login.js?v=24","./background.jpg","./manifest.webmanifest","./firestore.rules","./firebase.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("life-hub-")&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(cc=>cc.put(e.request,x));return r;})));});
