const CACHE="life-hub-v40-clean-deploy";
const ASSETS=["./","./index.html","./app.html","./login.html","./login.css","./auth-gate.js?v=40","./style.css","./data-v40.js","./script-v40.js","./login.js","./background.jpg","./manifest.webmanifest","./icon-192.svg","./icon-512.svg","./firestore.rules","./firebase.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("life-hub-")&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(cc=>cc.put(e.request,x));return r;})));});
