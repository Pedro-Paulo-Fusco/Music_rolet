// Service worker da Roleta dupla: guarda a casca do app para funcionar offline.
const CACHE = "roleta-dupla-v2";
const CASCA = ["./", "./index.html", "./manifest.webmanifest", "./icone.svg", "./icone-192.png", "./icone-512.png"];

self.addEventListener("install", function(evento){
  evento.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CASCA); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(evento){
  evento.waitUntil(
    caches.keys().then(function(chaves){
      return Promise.all(chaves.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(evento){
  var pedido = evento.request;
  // consultas ao MusicBrainz e à Wikipédia sempre vão à rede
  if(pedido.method !== "GET" || new URL(pedido.url).origin !== location.origin) return;
  evento.respondWith(
    caches.match(pedido).then(function(guardado){
      return guardado || fetch(pedido).then(function(resposta){
        var copia = resposta.clone();
        caches.open(CACHE).then(function(c){ c.put(pedido, copia); });
        return resposta;
      }).catch(function(){ return caches.match("./index.html"); });
    })
  );
});
