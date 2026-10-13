const CACHE = "scheissaufnbilla-counter-v9";
const ASSETS = [
    "./",
    "./index.html",
    "./impressum.html",
    "./datenschutz.html",
    "./bildnachweise.html",
    "./styles.css",
    "./app.js",
    "./manifest.json",
    "./img/captcha/lewakas/manifest.json",
    "./icons/app_icon.png",
    "./icons/app_icon_192.png",
    "./icons/app_icon_512.png",
    "./icons/app_icon_maskable.png",
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
    if (new URL(req.url).origin !== self.location.origin) return;

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
