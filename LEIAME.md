# Roleta dupla — app

Sorteia um **estilo musical** e um **país**, destaca o país no mapa-múndi e traz **artistas reais**
dessa combinação, com capa de álbum, prévia de 30 segundos e links para ouvir.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | O app inteiro: roletas, mapa, filtros, modo festa, favoritos e histórico |
| `manifest.webmanifest` | Torna o app instalável (nome, ícones, cores) |
| `sw.js` | Service worker: página sempre pela rede, com cache de reserva para uso offline |
| `worker.js` | **Opcional.** Cloudflare Worker que guarda as chaves do Spotify |
| `icone.svg`, `icone-192.png`, `icone-512.png` | Ícones do app |

> `worker.js` **não** vai para o GitHub Pages junto com os outros: ele é colado no
> painel da Cloudflare. Pode ficar no repositório apenas como referência.

## Publicar no GitHub Pages

1. Envie os arquivos para a raiz do repositório.
2. **Settings → Pages**, branch `main`, pasta `/ (root)`.
3. Ao publicar uma versão nova, altere a linha `const CACHE = "roleta-dupla-vN"`
   no `sw.js`. Sem isso, quem já abriu o app continua vendo a versão antiga.

## O que o app faz

### Roletas
Cada roda tem sua lista, recolhida atrás do botão **Editar lista**. O botão **Travar**
segura uma das rodas no resultado atual, para explorar só a outra.

### Filtros
**Não repetir combinações já sorteadas** elimina do sorteio tudo que já saiu — o app
calcula em qual fatia a roda deve parar, então a animação continua honesta.
**Reiniciar filtros** limpa as travas e libera todas as combinações de novo.

### Modo festa
Cadastre as pessoas da roda e clique em **Sortear para todos**: cada uma recebe sua
combinação, em giros rápidos e sem repetir. **Montar playlist do grupo** busca um
artista para cada combinação e monta a lista, exportável em CSV ou como mensagem
pronta para o WhatsApp.

### Favoritos
A estrela em cada cartão de artista guarda a descoberta neste aparelho. A lista sai
em CSV (para planilha) ou como texto formatado para colar em conversa.

## De onde vêm os dados

- **Mapa-múndi**: contornos vetoriais embutidos no HTML, sem rede.
- **Artistas**: [MusicBrainz](https://musicbrainz.org), consultado por gênero e país.
- **Resumo e foto**: Wikipédia em português, com queda para o inglês.
- **Capa e prévia de 30 s**: catálogo da Apple (sem cadastro) ou Spotify, se você
  configurar o worker.
- **Histórico, favoritos e preferências**: ficam no navegador; nada sai do aparelho.

## Ligar o Spotify (opcional)

As instruções passo a passo estão no topo do `worker.js`. Depois de publicar o worker,
cole o endereço dele no campo que fica em **Favoritos → Usar o Spotify**.

Vale saber: desde o fim de 2024 o Spotify devolve `preview_url` vazio para a maioria
dos apps novos. Quando isso acontece, o app volta sozinho ao catálogo da Apple, que
continua entregando os 30 segundos. O ganho real do Spotify são as capas oficiais,
os gêneros catalogados e a contagem de seguidores.
