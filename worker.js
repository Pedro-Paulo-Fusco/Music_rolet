/**
 * Worker da Cloudflare para a Roleta dupla.
 *
 * Guarda as credenciais do Spotify no servidor e devolve, para um nome de artista,
 * a capa do álbum, o nome da faixa e a prévia de 30 segundos quando existir.
 *
 * Publicação (leva uns 5 minutos):
 *   1. Crie um app em https://developer.spotify.com/dashboard e anote o Client ID e o Client Secret.
 *   2. Em https://dash.cloudflare.com → Workers & Pages → Create → Worker, cole este arquivo.
 *   3. Em Settings → Variables and Secrets, adicione dois secrets:
 *        SPOTIFY_ID      = seu Client ID
 *        SPOTIFY_SECRET  = seu Client Secret
 *   4. (Recomendado) Ajuste ORIGENS abaixo para o endereço do seu GitHub Pages.
 *   5. Deploy. Cole o endereço do worker no campo "Usar o Spotify" dentro do app.
 *
 * Observação honesta: desde o fim de 2024 o Spotify passou a devolver preview_url
 * vazio para a maioria dos apps novos. Quando isso acontece, o app volta sozinho
 * para o catálogo da Apple, que continua entregando os 30 segundos.
 */

const ORIGENS = ["*"];   // troque por ["https://seu-usuario.github.io"] para restringir

let tokenCache = { valor: null, expira: 0 };

function cabecalhos(origem) {
  const liberado = ORIGENS.includes("*") ? "*" : (ORIGENS.includes(origem) ? origem : ORIGENS[0]);
  return {
    "Access-Control-Allow-Origin": liberado,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=86400"
  };
}

async function pegarToken(env) {
  const agora = Date.now();
  if (tokenCache.valor && tokenCache.expira > agora + 30000) return tokenCache.valor;

  const credencial = btoa(`${env.SPOTIFY_ID}:${env.SPOTIFY_SECRET}`);
  const resposta = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credencial}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!resposta.ok) throw new Error("falha ao autenticar no Spotify");

  const dados = await resposta.json();
  tokenCache = { valor: dados.access_token, expira: agora + dados.expires_in * 1000 };
  return tokenCache.valor;
}

async function buscarArtista(nome, token) {
  const url = "https://api.spotify.com/v1/search?type=artist&limit=1&q=" + encodeURIComponent(nome);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.artists && d.artists.items && d.artists.items[0]) || null;
}

async function faixaPrincipal(idArtista, token) {
  const url = `https://api.spotify.com/v1/artists/${idArtista}/top-tracks?market=BR`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const d = await r.json();
  const faixas = d.tracks || [];
  // dá preferência a uma faixa que tenha prévia disponível
  return faixas.find(f => f.preview_url) || faixas[0] || null;
}

export default {
  async fetch(pedido, env) {
    const origem = pedido.headers.get("Origin") || "";
    const cabs = cabecalhos(origem);

    if (pedido.method === "OPTIONS") return new Response(null, { headers: cabs });

    const url = new URL(pedido.url);
    if (!url.pathname.startsWith("/artista")) {
      return new Response(JSON.stringify({ erro: "use /artista?nome=..." }), { status: 404, headers: cabs });
    }

    const nome = (url.searchParams.get("nome") || "").trim();
    if (!nome) {
      return new Response(JSON.stringify({ erro: "informe o parâmetro nome" }), { status: 400, headers: cabs });
    }

    try {
      const token = await pegarToken(env);
      const artista = await buscarArtista(nome, token);
      if (!artista) return new Response(JSON.stringify({}), { headers: cabs });

      const faixa = await faixaPrincipal(artista.id, token);
      const imagem = (artista.images && artista.images[1]) || (artista.images && artista.images[0]) || null;
      const capaAlbum = faixa && faixa.album && faixa.album.images && faixa.album.images[1];

      return new Response(JSON.stringify({
        nome: artista.name,
        capa: (capaAlbum && capaAlbum.url) || (imagem && imagem.url) || "",
        previa: (faixa && faixa.preview_url) || "",
        faixa: (faixa && faixa.name) || "",
        generos: artista.genres || [],
        seguidores: (artista.followers && artista.followers.total) || 0,
        link: (artista.external_urls && artista.external_urls.spotify) || ""
      }), { headers: cabs });

    } catch (erro) {
      return new Response(JSON.stringify({ erro: String(erro.message || erro) }), { status: 502, headers: cabs });
    }
  }
};
