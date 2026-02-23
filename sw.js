const CACHE = "scheissaufnbilla-counter-v3";
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json",
    "./img/captcha/lewakas/manifest.json",
    "./icons/app_icon.png",
    "./icons/reddit_logo.png"
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k)))))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;

    e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
            return res;
        }).catch(() => {
            if (req.mode === "navigate") return caches.match("./index.html");
            return Response.error();
        }))
    );
});
