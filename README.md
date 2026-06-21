# LoveLine

Site em Astro, CSS e JavaScript para criar uma timeline minimalista de relacionamentos.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

O projeto está configurado para rodar em:

```txt
https://leonn190.github.io/LoveLine/
```

Configuração importante:

- `astro.config.mjs` usa `site: 'https://leonn190.github.io'` e `base: '/LoveLine'`.
- `.github/workflows/deploy.yml` usa GitHub Actions com Node 24.
- Em `Settings > Pages`, o Source deve ficar como `GitHub Actions`.

## Arquivos `.ll`

O botão de download gera um arquivo `.ll`, que é um `.zip` contendo:

- `data/loveline.json` com pessoas, eventos, períodos e estado da câmera.
- `images/...` com fotos usadas na LoveLine.

Na tela inicial, arraste um `.ll` para importar ou clique para começar do zero.
