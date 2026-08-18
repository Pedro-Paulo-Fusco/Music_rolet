# Roleta dupla — app

Sorteia um **estilo musical** e um **país**, destaca o país no mapa-múndi e traz **artistas reais**
dessa combinação, com foto, resumo e links para ouvir.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | O app inteiro: roletas, mapa, histórico e busca de artistas |
| `manifest.webmanifest` | Torna o app instalável (nome, ícones, cores) |
| `sw.js` | Service worker: guarda o app para abrir offline |
| `icone.svg`, `icone-192.png`, `icone-512.png` | Ícones do app |

## O que vem de onde

- **Mapa-múndi**: contornos vetoriais embutidos no próprio HTML, sem rede.
- **Artistas**: [MusicBrainz](https://musicbrainz.org) (busca por gênero + país).
- **Foto e resumo**: Wikipédia em português, com queda para o inglês.
- **Histórico**: guardado no navegador; nada sai do aparelho.
