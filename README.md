# LoveLine

Timeline minimalista de relacionamentos feita em Astro, CSS e JavaScript.

## Rodar localmente

```bash
npm install --no-package-lock --no-audit --no-fund
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

O deploy está configurado no mesmo padrão do repositório `Blood`:

- Astro em projeto na raiz do repo.
- `astro.config.mjs` com `site` e `base: '/LoveLine'`.
- GitHub Actions com Node `22.12.0`.
- `actions/configure-pages@v5` antes do build.
- `rm -f package-lock.json` antes do install para ignorar locks antigos quebrados.

No GitHub, deixe **Settings > Pages > Source** como **GitHub Actions**.

URL esperada:

```txt
https://leonn190.github.io/LoveLine/
```
