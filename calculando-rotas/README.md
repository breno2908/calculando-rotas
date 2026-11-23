# Calculando Rotas — Grafos e Dijkstra

Projeto web para cadastro de cidades (vértices) e estradas (arestas ponderadas), cálculo do menor caminho com **Dijkstra** e verificação de conectividade com **busca em largura (BFS)**.

## Tecnologias
- HTML, CSS e JavaScript puro
- Tailwind CSS via CDN para classes utilitárias
- Font Awesome e Google Fonts via CDN
- `localStorage` para persistência local no navegador (substitui o DataSystem do SITE123)
- Grafo não direcionado, representado por lista de adjacência

## Como executar
Abra `index.html` no navegador, ou use a extensão **Live Server** no VS Code. É necessária conexão com a internet para carregar Tailwind, Font Awesome e fontes externas.

## Arquivos
- `index.html`: interface e formulários
- `style.css`: estilos da interface
- `graph.js`: grafo, Dijkstra e BFS
- `app.js`: interações, renderização e gerenciamento dos dados
- `storage.js`: adaptador de armazenamento usando localStorage

## Observações
Esta é uma **adaptação independente** da versão publicada no SITE123, feita a partir do HTML e dos scripts fornecidos. Os estilos foram reconstruídos, e os dados são salvos somente no navegador atual. Não é uma exportação integral do projeto interno do SITE123.

Site original: https://6b04bd2216935.site123.me/
