# Sintonia dupla — documentação do projeto

Registro do processo de construção, das decisões técnicas e do motivo de cada uma.
Foco em funcionalidade e arquitetura; escolhas puramente estéticas ficaram de fora —
com uma exceção declarada na seção 14, onde a estética *era* o problema a resolver.

**O que o app faz:** sintoniza um estilo musical e um país, destaca o país no mapa-múndi,
busca artistas reais dessa combinação com capa e prévia de 30 segundos, oferece playlists
da combinação (e cria uma na conta do Spotify de quem quiser), guarda histórico e
favoritos, e roda instalado no celular.

> **Nota sobre as seções 1 a 13.** Elas descrevem o app como *Roleta dupla*, com duas
> roletas de fatias e ponteiro. A partir da seção 14 as roletas viraram mostradores de
> instrumento e o app virou *Sintonia dupla*. O texto anterior foi mantido como está:
> é o registro de por que cada coisa foi feita daquele jeito, e várias decisões
> (sorteio dirigido, divisórias como pinos, animação honesta) continuam valendo com
> outra pele.

---

## 1. Fase inicial — as roletas funcionais

### O problema
Sortear itens de duas listas independentes, com feedback visual honesto: a pessoa
precisa acreditar que o resultado saiu do giro, e não de um sorteio escondido.

### Como foi resolvido

**Desenho em `<canvas>`, não em SVG nem em CSS.** Cada roda é redesenhada quadro a
quadro durante o giro. Um SVG com 40 elementos girando via CSS até funcionaria, mas o
canvas permite recalcular texto, ângulo e espessura conforme o número de itens muda —
e a lista é editável, então o número de fatias varia em tempo de execução.

**Divisórias como requisito explícito.** Linhas brancas do miolo até a borda separam
cada item. Não é decoração: é o que permite ao olho contar as fatias e conferir onde o
ponteiro parou.

**Ponteiro com física simples.** A cada divisória que passa sob o ponteiro, ele é
desviado por um ângulo proporcional à velocidade atual da roda, e volta ao repouso
conforme desacelera. O cálculo é: descobrir a fase atual dentro da fatia
(`0` = acabou de passar um pino, `1` = prestes a passar o próximo) e aplicar
`deslocamento = máximo × força × (1 − fase)`. Isso reproduz o comportamento de uma
roleta física e reforça a sensação de sorteio real.

**Som sintetizado, sem arquivo de áudio.** O "tique" de cada divisória é gerado pela
Web Audio API — um oscilador quadrado com queda rápida de frequência e volume. Evita
carregar arquivos e mantém o app leve.

**Determinação do vencedor.** O ponteiro fica fixo no ângulo 0 (lateral direita). O
índice sorteado é calculado a partir da rotação final:

```
d = (0 − rotação) módulo 2π
índice = piso(d ÷ tamanho_da_fatia)
```

Ou seja, o resultado é lido da posição final da roda, não sorteado antes. Isso importa
porque garante coerência entre o que se vê e o que o app anuncia — e mais tarde
precisou ser invertido de propósito (ver seção 6).

**Escala de fonte adaptativa.** Com 40 itens, cada fatia tem 9 graus. O corpo da fonte
é calculado a partir da altura disponível na fatia, com reticências quando o nome ainda
assim não cabe. Sem isso, listas longas ficariam ilegíveis ou sobrepostas.

### Decisão de conteúdo: gêneros universais
As listas iniciais tinham forró, fado, maracatu, k-pop. O cruzamento com país produzia
resultados vazios: não existe cena de forró na Noruega. A lista foi refeita com 40
gêneros de alcance global, organizados por família (8 de rock, 8 de metal, 8 de
eletrônica, 6 de pop, 10 de raízes e derivados). **Motivo:** o valor do app está no
cruzamento, e o cruzamento só funciona se ambos os eixos forem independentes. Gênero
preso a um país torna 39 dos 40 países inúteis para aquele item.

---

## 2. Mapa-múndi embutido

### O problema
Mostrar onde fica o país sorteado, sem depender de serviço externo, sem chave de API e
sem custo por requisição.

### Como foi resolvido

Um mapa vetorial de domínio público (176 países) foi processado offline e embutido
diretamente no HTML. O pipeline de preparação:

1. **Achatamento das curvas.** Os contornos originais usam curvas de Bézier. Cada curva
   foi convertida em segmentos de reta, com número de passos proporcional ao tamanho do
   trecho.
2. **Simplificação Douglas-Peucker.** Remove pontos que não alteram a silhueta acima de
   uma tolerância. Reduziu o volume de dados em cerca de 85%.
3. **Descarte de ruído.** Ilhas minúsculas e a Antártida foram removidas — não
   contribuem para a leitura e ocupavam espaço.
4. **Arredondamento de coordenadas** para uma casa decimal, num sistema de 1000 unidades
   de largura.

Resultado: **97 KB de contornos**, contra 778 KB do original. Cada país virou um
`<path>` com identificador no padrão ISO (`p-br`, `p-jp`), o que permite acender
qualquer um por seletor.

**Um detalhe que quase passou.** Na primeira execução, só 93 dos 176 países apareceram.
A causa: o algoritmo de simplificação mede a distância de cada ponto até a reta que liga
o primeiro ao último ponto. Em polígonos fechados — que é o caso de todo país — esses
dois pontos coincidem, a reta tem comprimento zero e todas as distâncias davam zero, o
que apagava o contorno inteiro. A correção foi detectar o caso degenerado e medir a
distância radial a partir do ponto inicial.

**Enquadramento automático.** Ao sortear, a área visível do mapa é animada até a caixa
delimitadora do país, com margem proporcional. Países pequenos, como Jamaica e Islândia,
ganham um anel pulsante em volta, porque mesmo com zoom eles somem visualmente.

**Tradução de nome para código.** Uma tabela converte o nome digitado em código ISO,
aceitando português, inglês e variações sem acento. Países fora do mapa mostram aviso
em vez de quebrar. Foi aqui que "Escócia" virou "Reino Unido" na lista: o mapa trabalha
com países, não com nações constituintes.

---

## 3. Busca de artistas — por que não usar IA

### A primeira tentativa e por que foi descartada
A versão inicial chamava um modelo de linguagem para listar artistas. Dois problemas:
funcionava apenas dentro de um ambiente específico, e os nomes eram plausíveis sem
garantia de existirem. Num app cujo propósito é descoberta musical, um artista inventado
é pior do que nenhum resultado.

### A solução: consulta a um catálogo real
**MusicBrainz** é uma base musical aberta, catalogada por gênero e país. A consulta é
literal:

```
tag:"black metal" AND country:NO
```

O cruzamento acontece no banco de dados, não na inferência. Isso traz três ganhos:
os artistas existem, o filtro por país é o registrado oficialmente na base, e os
resultados são reproduzíveis.

Uma tabela converte os rótulos em português para as etiquetas em inglês usadas pela base
(`Rock clássico` → `classic rock`), e o código ISO já disponível do mapa é reaproveitado
como filtro de país.

### Enriquecimento em camadas
Cada resultado é complementado por fontes independentes, todas gratuitas e sem cadastro:

| Camada | Fonte | O que traz |
|---|---|---|
| Identificação | MusicBrainz | nome, tipo, região, anos de atividade, etiquetas |
| Contexto | Wikipédia (pt, com queda para en) | resumo em duas frases e foto |
| Áudio | Catálogo da Apple | capa do álbum e prévia de 30 segundos |
| Áudio (opcional) | Spotify, via worker | capas oficiais, gêneros catalogados |

**Detalhe técnico relevante:** a busca da Apple não libera CORS, o que impediria a
chamada direta do navegador. A solução foi usar JSONP — injetar uma tag `<script>` com
um nome de função de retorno, técnica anterior ao CORS e ainda suportada por esse
endpoint. Evitou ter de criar um backend só para isso.

**Limite de taxa.** O MusicBrainz pede no máximo uma consulta por segundo. No modo
festa, onde há várias buscas em sequência, há um intervalo de 1,1 segundo entre elas.
Ignorar isso levaria a bloqueio por IP.

---

## 4. Persistência — guardar sem servidor

Histórico, favoritos, participantes do modo festa, tema escolhido e endereço do worker
ficam no armazenamento local do navegador. Nada sai do aparelho, o que dispensa banco de
dados, cadastro e política de privacidade.

O acesso é feito por uma camada que testa a disponibilidade do armazenamento e, se
estiver bloqueado — navegação privada, restrições corporativas —, cai para memória. O
app continua funcionando; apenas esquece ao fechar. **Motivo:** falhar silenciosamente
em modo degradado é melhor do que quebrar a tela inteira por causa de um recurso
secundário.

---

## 5. Filtros e sorteio dirigido

### O problema
Três pedidos exigiam controle sobre o resultado: não repetir combinações já sorteadas,
travar uma das rodas, e sortear para várias pessoas sem repetição.

### A inversão do fluxo
Aqui a lógica original precisou ser invertida. Antes: **gira e lê o resultado.** Agora:
**escolhe o resultado e calcula onde a roda deve parar.**

```
1. Monta a lista de combinações válidas (respeitando travas e filtros)
2. Sorteia uma dessa lista
3. Calcula o ângulo final que faz o ponteiro cair naquela fatia
4. Anima até lá, com voltas completas antes
```

O ângulo final recebe um deslocamento aleatório dentro da fatia, para a roda não parar
sempre no mesmo ponto. A animação continua idêntica — mesma desaceleração, mesmo
ponteiro batendo nas divisórias. O que mudou é que o destino é conhecido antes.

**Por que isso é aceitável:** o sorteio continua sendo aleatório; o que se restringiu foi
o espaço amostral, a pedido do usuário. Se todas as combinações se esgotam, o app avisa
em vez de girar em falso.

**Trava com salvaguarda.** Travar uma roda que ainda não girou não faz sentido — não há
resultado para segurar. Nesse caso a trava é ignorada e a roda gira normalmente. Foi um
defeito encontrado em teste automatizado, com a roda travada devolvendo "sem combinação
livre" para todos os participantes.

---

## 6. Modo festa

Cada pessoa da roda recebe uma combinação própria, em giros sequenciais e mais rápidos
(1,5 s em vez de 4,2 s — a espera se multiplicaria pelo número de participantes). O
filtro de não repetição vale entre as pessoas, então ninguém recebe a mesma combinação.

Ao final, "Montar playlist do grupo" busca um artista para cada combinação, respeitando
o limite de consultas por segundo, e monta a lista com prévia tocável.

**Escolha do artista:** é sorteado entre os três primeiros resultados, não fixado no
primeiro. Motivo: rodadas repetidas da mesma combinação devolveriam sempre o mesmo nome,
o que esvazia o propósito de descoberta.

---

## 7. Favoritos e exportação

A estrela em cada cartão guarda a descoberta. A exportação tem dois formatos, porque
servem a usos diferentes:

- **CSV** — para planilha. Separador ponto e vírgula e marca BOM no início do arquivo,
  que é o que faz o Excel em português abrir os acentos corretamente e separar as
  colunas sem precisar do assistente de importação.
- **Texto formatado** — mensagem pronta para colar em conversa, com marcadores e
  negrito no padrão do WhatsApp (`*texto*`), copiada direto para a área de transferência.

A cópia usa a API moderna de área de transferência com retorno ao método antigo
(campo de texto oculto + comando de cópia) quando ela não está disponível, o que
acontece em contexto não seguro.

---

## 8. Transformação em aplicativo (PWA)

Um arquivo HTML aberto do disco já funcionava. Transformá-lo em app exigiu quatro
elementos:

| Elemento | Função | Por que é necessário |
|---|---|---|
| `manifest.webmanifest` | Nome, ícones, cor, modo de exibição | Sem ele o navegador não oferece instalação |
| `sw.js` (service worker) | Intercepta requisições, guarda arquivos | Permite abrir sem conexão |
| Ícones 192 e 512 px | Tela de início e telas de abertura | Tamanhos exigidos pela especificação |
| Hospedagem em HTTPS | GitHub Pages | Service worker só funciona em contexto seguro |

**Modo standalone.** Com `"display": "standalone"` no manifesto, o app abre em tela
cheia, sem barra de endereço, indistinguível de um aplicativo nativo.

**Caminhos relativos.** Todos os arquivos se referenciam por caminho relativo (`./`),
o que permite publicar em subdiretório (`usuario.github.io/repositorio/`) sem ajuste.

**O service worker precisa ficar na raiz**, ao lado do `index.html`. O escopo dele é
limitado à pasta onde está; colocá-lo em `js/` ou `assets/` faria com que deixasse de
cobrir a página, e o modo offline não funcionaria.

---

## 9. A armadilha do cache — e a correção

### O sintoma
Arquivos atualizados no repositório, deploy concluído, e a página continuava mostrando
a versão antiga.

### A causa
A primeira versão do service worker usava estratégia **cache-first**: respondia sempre
pela cópia guardada e só ia à rede quando não tinha o arquivo. Ótimo para velocidade e
para offline, péssimo para atualização — a versão nova nunca chegava.

### A correção
A estratégia foi separada por tipo de conteúdo:

- **A página (`index.html`): network-first.** Tenta a rede primeiro e atualiza o cache
  com o que recebeu; só usa a cópia guardada se não houver conexão. Atualização passa a
  ser imediata, e o offline continua garantido.
- **Demais arquivos: cache com revalidação.** Responde na hora pela cópia guardada e
  atualiza em segundo plano. Ícones e manifesto quase nunca mudam.

### Práticas que acompanham
- **Versionar o cache.** A constante `CACHE = "roleta-dupla-vN"` deve ser incrementada a
  cada publicação. É o que descarta a versão anterior.
- **Etiqueta de versão visível** no rodapé do app. Permite conferir em segundos o que
  está no ar, em vez de deduzir.
- **Aviso de atualização.** Quando o app detecta uma versão nova instalada, mostra um
  botão para recarregar.

**Como destravar um cliente preso na versão antiga:** ferramentas do desenvolvedor →
Application → Service Workers → Unregister, seguido de Clear site data. No celular,
limpar os dados do site ou reinstalar o app.

---

## 10. Backend mínimo — o Cloudflare Worker

### Por que um backend foi necessário
Para consultar a API do Spotify é preciso autenticar com um par de credenciais
(Client ID e Client Secret). Colocá-las no HTML significaria publicá-las para qualquer
pessoa que abrisse o código-fonte da página — qualquer um poderia usar a cota, e a
credencial teria de ser revogada. **Segredo em código de navegador não é segredo.**

### A solução
Um Cloudflare Worker de arquivo único, gratuito no plano básico (100 mil requisições por
dia), que:

1. Guarda as credenciais como *secrets* no servidor, nunca expostas ao navegador.
2. Autentica no Spotify pelo fluxo **Client Credentials** — servidor a servidor, sem
   login de usuário, adequado para dados públicos de catálogo.
3. Recebe um nome de artista, devolve capa, faixa e prévia em JSON.
4. Guarda o token em memória até expirar, evitando reautenticar a cada consulta.
5. Controla CORS por lista de origens, restringindo o uso ao domínio do próprio app.

### Duas armadilhas do cadastro no Spotify
- **URI de redirecionamento.** Desde novembro de 2025 o Spotify recusa endereços em HTTP
  e o apelido `localhost`. O aceito é o endereço de loopback numérico com porta:
  `http://127.0.0.1:3000/callback`. O campo é obrigatório no formulário, mas o fluxo
  Client Credentials nunca o utiliza.
- **Segredos exigem novo deploy.** Cadastrar as variáveis não basta; elas só chegam ao
  código em execução após publicar de novo.

### Limitação assumida
Desde o fim de 2024 o Spotify devolve o campo de prévia vazio para aplicativos novos.
Por isso o app trata o Spotify como **camada opcional de enriquecimento**, e usa o
catálogo da Apple como fonte padrão de áudio — que não exige cadastro, chave nem
backend. Se a prévia do Spotify vier vazia, a queda para a Apple é automática.

**Princípio geral:** a funcionalidade principal nunca depende de configuração opcional.
O app funciona por completo sem o worker.

---

## 11. Arquitetura final

```
index.html            aplicação inteira: interface, mostradores, mapa, lógica e dados
manifest.webmanifest  metadados de instalação
sw.js                 service worker (rede primeiro para a página)
icone.svg / 192 / 512  ícones
worker.js             opcional, publicado na Cloudflare — não no GitHub Pages
```

**Por que arquivo único?** Sem etapa de build, sem dependências, sem gerenciador de
pacotes. Publicar é copiar arquivos. Depurar é abrir o código-fonte. Para um projeto
desse porte, a simplicidade de manutenção vale mais do que a modularização.

### Serviços externos e o que acontece se falharem

| Serviço | Uso | Se cair |
|---|---|---|
| MusicBrainz | busca de artistas | mensagem e atalhos manuais de busca |
| Wikipédia | resumo e foto | cartão sem resumo, resto funciona |
| Apple | capa e prévia | cartão sem áudio, resto funciona |
| Cloudflare Worker | Spotify: capas e busca de playlists (opcional) | queda para a Apple; playlists caem para os links de busca |
| Conta do Spotify (PKCE) | criar playlist do usuário (opcional) | seção some fora de https; erros traduzidos na tela |

Roletas, mapa, filtros, histórico, favoritos e exportação **não dependem de rede alguma**.

---

## 12. Checklist de publicação

1. Substituir os arquivos na raiz do repositório.
2. Incrementar `CACHE = "sintonia-dupla-vN"` no `sw.js`.
3. Atualizar a etiqueta de versão no rodapé do `index.html`.
4. Confirmar o build verde na aba Actions do repositório.
5. Abrir o app e conferir a etiqueta de versão no rodapé.

---

## 13. Limitações conhecidas e próximos passos

**Limitações**
- Dados guardados por aparelho: histórico e favoritos não sincronizam entre celular e
  computador.
- Cobertura do MusicBrainz é desigual: cenas menores têm menos artistas catalogados.
- Prévia do Spotify indisponível para aplicativos novos.
- Listas editadas nos mostradores valem apenas na sessão atual.
- Criar playlist na conta exige app próprio no Spotify e só funciona no app publicado
  (https); em modo de desenvolvimento, apenas o dono e até 25 pessoas cadastradas.
- A playlist criada usa os artistas já listados na tela: se a busca não trouxe ninguém,
  não há o que montar.

**Próximos passos possíveis**
- Compartilhamento nativo pela Web Share API, abrindo a bandeja do sistema no celular.
- Persistir as listas editadas junto com as demais preferências.
- ~~Exportar favoritos para playlist real, o que exige login do usuário no Spotify
  (fluxo de autorização com PKCE)~~ — **feito na seção 16**, e sem ampliar o worker:
  o PKCE dispensa segredo, então o navegador fala direto com o Spotify.
- Sincronização entre aparelhos por código de sessão.

---

## 14. Repaginação — de roleta para mostrador

### O problema
O app é sobre descobrir música, mas as duas rodas de fatias coloridas com ponteiro
liam como **jogo de azar**. A associação era com cassino, não com garimpo musical. O
nome não ajudava: *Roleta dupla* é literalmente a metáfora errada.

Junto vinha um problema de leitura: com 122 estilos e 138 países no catálogo, mostrar
todas as opções na roda significava 122 fatias de 3 graus cada. Ilegível e inútil — a
pessoa não escolhe entre 122 coisas olhando, ela quer ver o que saiu.

### Como foi resolvido

**A roda virou mostrador de instrumento.** Um velocímetro: escala circular de 260 graus,
uma marca fixa no topo, e a escala correndo por baixo dela. Todo o vocabulário mudou
junto — girar virou *acionar*, resultado virou *leitura*, roleta virou *mostrador*.

**Escala reduzida por decisão, não por limitação.** O mostrador exibe só a vizinhança da
leitura: o item sob a marca mais uns três de cada lado, apagando gradualmente nas bordas.
Os vizinhos aparecem em sigla monoespaçada de até seis caracteres (`COR·SU` para
"Coreia do Sul"), e o nome inteiro fica no núcleo do mostrador com corpo que se ajusta
sozinho. **Motivo:** um instrumento mostra a leitura e a vizinhança dela, não o catálogo
inteiro. Isso resolveu de uma vez a legibilidade e a metáfora.

**A sigla é gerada, não cadastrada.** Remove acentos, descarta ligações (*do, da, de,
of, the*) e junta as três primeiras letras da primeira palavra com as duas da segunda.
"Estados Unidos" vira `EST·UN`, "Música eletrônica" vira `MUS·EL`. Sem tabela para
manter quando a lista muda.

**Conta-giros honesto.** Os 52 traços do aro acendem conforme a velocidade angular real
da escala e entram no vermelho no topo da faixa, drenando até apagar quando a leitura
trava. Não é enfeite: é a mesma grandeza que move a animação, exibida.

**A mecânica do sorteio dirigido foi preservada.** A seção 5 explica por que o vencedor
é escolhido antes e a animação é calculada para chegar nele — é o que viabiliza filtros,
travas e modo festa. O que mudou é a unidade: em vez de voltas inteiras da roda, o giro
agora conta **passos sob a marca**. O alvo é um índice, a distância é
`(alvo − atual) mod n`, e some-se um número de voltas escolhido para a varredura durar
entre 10 e 40 passos, independente do tamanho da lista. Com 122 itens, contar voltas
faria a escala passar 122 itens por volta e o tique soar centenas de vezes.

### O que se ganhou de quebra
Trocar 122 fatias desenhadas por ~9 rótulos visíveis derrubou o custo de cada quadro.
O desenho passou a ser O(vizinhança) em vez de O(catálogo).

---

## 15. O console de bordo

### O problema
Com dois instrumentos na tela, o painel de resultado continuava um cartão escuro
genérico: uma frase (`Doom metal → México`), dois botões e seções empilhadas. Não
conversava com o resto.

### Como foi resolvido

**Barra de identificação com LED de estado.** Uma faixa monoespaçada no topo do painel,
com um LED que lê o estado real do app: *em espera* (apagado, respirando devagar),
*varrendo* (âmbar, piscando), *leitura fixa* (âmbar sólido) e *travado* (vermelho,
quando algum mostrador está com trava). O estado vem de um callback novo (`aoEstado`)
disparado pelo componente do mostrador no início e no fim da varredura e na trava —
**não é polling nem timer**.

**A frase virou dois compartimentos.** Slots rotulados `ESTILO` e `PAÍS` com um `×`
entre eles. Vazio mostra `—`: o LED já diz que está em espera, não precisa de frase.

**Telemetria com números que já existiam.** Uma linha monoespaçada mostra escalas
(`45 × 48`), combinações possíveis, já sintonizadas e restantes. Tudo sai do cruzamento
entre o tamanho das duas listas e o registro de combinações usadas, que já era
persistido para o filtro de não repetir. **Nenhum número novo foi inventado para
preencher painel.**

**Sem caixa dentro de caixa.** As seções (leitura, telemetria, filtros, registro, mapa,
descoberta) são separadas por fios de 1px e espaço, não por cartões aninhados.

---

## 16. Playlists — e o login que faltava

### O problema
Depois de sortear, o app entregava artistas soltos. Faltava a saída óbvia para quem
gostou da combinação inteira: **ouvir aquilo**.

### Duas camadas, porque as garantias são diferentes

Seguindo o princípio da seção 10 — a função principal nunca depende de configuração
opcional — a coisa foi partida em duas:

**Camada 1, sem configurar nada.** Dois links abrem a busca de playlists para
`"<estilo> <país>"` direto no Spotify e no YouTube. Funciona para qualquer pessoa que
abrir o app, hoje.

**Camada 2, com o worker.** O botão *Trazer playlists* busca playlists públicas da
combinação e monta uma trilha horizontal com capa, número de faixas e quem montou. O
worker ganhou a rota `/playlists?q=...`, ainda em Client Credentials — dados públicos
de catálogo não precisam de usuário.

**Detalhe da API que virou código:** desde 2024 a busca de playlists do Spotify devolve
`null` no meio da lista de resultados. O worker filtra esses buracos antes de responder.

### O login do usuário: PKCE

Criar playlist **na conta de alguém** é outra categoria: exige agir como aquela pessoa,
não ler catálogo público. Isso pede o fluxo *Authorization Code*, com o usuário fazendo
login no Spotify.

**Por que não passou pelo worker.** O instinto seria mandar mais essa pelo backend, já
que a seção 10 estabeleceu que segredo não vive no navegador. Mas o **PKCE** existe
exatamente para este caso: o app gera um segredo efêmero por autorização (o
*verificador*), manda ao Spotify apenas o hash SHA-256 dele (o *desafio*), e só apresenta
o verificador original na hora de trocar o código pelo token. Quem interceptar o código
no meio do caminho não tem o verificador, e o código não serve para nada.

Resultado: **nenhum segredo no navegador e nenhum código novo no worker.** O Client ID
é público por natureza nesse fluxo. O Client Secret não é usado — e o campo na tela
avisa explicitamente para não colá-lo ali.

**Como foi implementado**

1. O verificador (64 caracteres do alfabeto não reservado) e o `state` anti-CSRF ficam
   em `sessionStorage` — morrem com a aba, que é o tempo de vida correto para eles.
2. O desafio sai de `crypto.subtle.digest("SHA-256", ...)` em base64url.
3. Na volta, o app confere o `state`, troca o código pelo token e limpa a URL com
   `history.replaceState` — o código de autorização não fica no histórico do navegador.
4. Token e refresh token ficam em `localStorage`; o token é renovado sozinho quando
   falta menos de um minuto para expirar.

A implementação foi conferida contra o **vetor de teste da RFC 7636, seção 4.6**: para o
verificador `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`, o desafio produzido é
`E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`, que é o valor esperado pela norma.

**Montagem da playlist.** Para cada artista da lista atual, o app procura o artista no
Spotify, confere se o nome bate de verdade (a mesma checagem já usada para capas — melhor
faltar artista do que entrar o errado) e pega as três faixas mais tocadas dele no mercado
da conta. A playlist nasce **privada**, com nome `<estilo> × <país>`. Um artista que
falha não derruba a criação: o erro é engolido e a fila segue.

**Escopos pedidos:** `playlist-modify-private` e `user-read-private`. Só isso. Não se
pede permissão de playlist pública para criar playlist privada.

### Degradação e limites assumidos
- **Fora de https, a seção some.** O Spotify só aceita retorno em https (ou loopback
  numérico), e `crypto.subtle` nem existe em contexto inseguro. Abrindo o arquivo local,
  o app diz isso em vez de oferecer um botão que ia falhar.
- **Modo de desenvolvimento.** App novo no Spotify começa restrito: só o dono e até 25
  pessoas que ele cadastrar conseguem autorizar. Quem não estiver na lista recebe 403, e
  o app traduz esse código para essa explicação.
- **Playlists do próprio Spotify saíram da API.** Discover Weekly, Daily Mix e as "This
  Is" não voltam mais para apps novos. O texto de apoio diz isso, em vez de deixar
  parecer que a busca falhou.

### Dois bugs que os testes pegaram
- **A trilha empurrava a página.** Os cartões estouravam a largura do documento em vez
  de rolar dentro do próprio contêiner: item de grid tem `min-width:auto` por padrão, e
  faltava `min-width:0` na cadeia até a trilha.
- **Resultado vazio entrava no cache.** O botão virava "Tentar de novo" e não tentava
  nada, porque a chave já estava gravada com lista vazia. Agora só resultado cheio é
  cacheado; vazio e erro sempre repetem a consulta.

---

## Resumo das decisões que mais importaram

1. **Canvas em vez de elementos fixos** — permitiu listas de tamanho variável.
2. **Gêneros universais em vez de regionais** — sem isso, o cruzamento não produz
   resultado.
3. **Mapa processado e embutido** — mapa completo sem rede, chave ou custo.
4. **Catálogo real em vez de geração por IA** — artistas que existem.
5. **JSONP para o catálogo da Apple** — capa e áudio sem precisar de backend.
6. **Sorteio dirigido com animação honesta** — viabilizou filtros, travas e modo festa.
7. **Network-first para a página** — corrigiu a atualização travada pelo cache.
8. **Credenciais no worker, nunca no HTML** — segredo em navegador não é segredo.
9. **Degradação suave em toda camada externa** — nenhuma falha de rede derruba o app.
10. **Instrumento em vez de roleta** — a metáfora estava contando a história errada, e
    trocá-la resolveu de quebra a legibilidade de um catálogo que cresceu 3×.
11. **Estado do console vindo de callback, não de polling** — o LED lê o app, não
    adivinha.
12. **PKCE em vez de mais backend** — login de usuário sem segredo no navegador e sem
    uma linha nova no worker.
