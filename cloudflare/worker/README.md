# volleyfvg-social-preview

Cloudflare Worker che genera le preview social dei tornei di
[volleyfvg.it](https://volleyfvg.it), stando davanti a GitHub Pages.

Documentazione completa: [`docs/social-preview.md`](../../docs/social-preview.md).

## In due righe

Il Worker inoltra tutto a GitHub Pages. Quando la richiesta è la pagina del
sito con `?torneo=<slug>`, legge quel torneo da Firestore (in anonimo, senza
credenziali) e riscrive i meta tag Open Graph dentro l'HTML vero prima di
consegnarlo. Non serve un nuovo build del frontend per ogni torneo.

## Comandi

```bash
npm install

npm test              # 30 test sulle funzioni pure
npm run test:runtime  # 27 test dentro workerd (HTMLRewriter, cache, proxy)
npm run test:all

cp .dev.vars.example .dev.vars
npm run dev           # http://localhost:8787
./test/curl.sh        # verifica end-to-end

npm run deploy:staging  # *.workers.dev, senza toccare il DNS
npm run deploy          # produzione (solo durante il cutover)
npm run tail            # log dal vivo
```

## Segreti

Nessuno. Firestore è leggibile in anonimo sui tornei pubblicati, e tutte le
variabili in `wrangler.jsonc` sono valori pubblici. Se un giorno servisse una
credenziale: `npx wrangler secret put NOME`, mai nel repository.
