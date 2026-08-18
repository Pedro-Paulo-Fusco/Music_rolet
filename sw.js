// Service worker da Roleta dupla.
// Estratégia: a página sempre tenta a rede primeiro (para atualizar na hora)
// e só cai no cache quando não há conexão. Os demais arquivos usam cache
// com revalidação em segundo plano.
const CACHE = "roleta-dupla-v4";
const CASCA = ["./", "./index.html", "./manifest.webmanifest", "./icone.svg", "./icone-192.png", "./icone-512.png"];

self.addEventListener("install", function(evento){
  evento.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(CASCA); }).then(function(){ return self.skipWaiting(); })
  );
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
  if(pedido.method !== "GET") return;
  if(new URL(pedido.url).origin !== location.origin) return;   // MusicBrainz e Wikipédia vão direto à rede

  // navegação: rede primeiro, cache como reserva
  if(pedido.mode === "navigate" || (pedido.headers.get("accept") || "").indexOf("text/html") >= 0){
    evento.respondWith(
      fetch(pedido).then(function(resposta){
        var copia = resposta.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copia); });
        return resposta;
      }).catch(function(){
        return caches.match("./index.html").then(function(g){ return g || caches.match("./"); });
      })
    );
    return;
  }

  // demais arquivos: responde do cache e atualiza por trás
  evento.respondWith(
    caches.match(pedido).then(function(guardado){
      var rede = fetch(pedido).then(function(resposta){
        var copia = resposta.clone();
        caches.open(CACHE).then(function(c){ c.put(pedido, copia); });
        return resposta;
      }).catch(function(){ return guardado; });
      return guardado || rede;
    })
  );
});
