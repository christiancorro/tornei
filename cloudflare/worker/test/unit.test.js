/* ---------------------------------------------------------
   Test unitari delle funzioni pure del Worker.

     npm test        (node --test test/)

   Girano in Node senza Wrangler e senza rete: coprono
   escaping, validazione URL, formattazione delle date,
   costruzione dei meta tag e filtro dello slug. La parte che
   dipende dal runtime (HTMLRewriter, cache, proxy) si prova
   con `npm run dev` e gli script in test/curl.sh.
--------------------------------------------------------- */
import test from 'node:test';
import assert from 'node:assert/strict';

import { formatData, formatLuogo, troncaTesto } from '../src/format.js';
import {
  escapeHtml,
  safeHttpsUrl,
  buildPreview,
  renderMetaTags,
} from '../src/preview.js';
import { leggiSlug } from '../src/index.js';

const ENV = {
  SITE_URL: 'https://volleyfvg.it',
  SITE_NAME: 'Volley FVG',
  FALLBACK_IMAGE: 'https://volleyfvg.it/icons/icon512.png',
  FALLBACK_IMAGE_WIDTH: '512',
  FALLBACK_IMAGE_HEIGHT: '512',
  FALLBACK_DESCRIPTION: 'Tornei di green volley, beach volley e pallavolo in Friuli Venezia Giulia e dintorni.',
};

/* Il documento vero letto da Firestore, campi e valori inclusi. */
const TORNEO = {
  nome: '1° Madonna del Bembo',
  data: '2026-09-06',
  dataFine: '',
  ora: '09:00',
  comune: 'Azzano Decimo (PN)',
  locandina:
    'https://firebasestorage.googleapis.com/v0/b/volleyfvg-6ad3e.firebasestorage.app/o/locandine%2F1787149886175-0lda66.webp?alt=media&token=6c903180-3b4a-4c41-b260-efa1e2dc8a9d',
  locandinaThumb:
    'https://firebasestorage.googleapis.com/v0/b/volleyfvg-6ad3e.firebasestorage.app/o/locandine%2F1787149886175-0lda66-thumb.webp?alt=media&token=a003c3f1-9458-4b5d-97c8-003cebf52f17',
  status: 'published',
};

/* ---------------- escapeHtml ---------------- */

test('escapeHtml copre tutti e cinque i caratteri pericolosi', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test("escapeHtml gestisce l'ampersand per primo, senza doppia entita'", () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
});

test('escapeHtml su null/undefined da stringa vuota', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test("un nome torneo ostile non riesce a uscire dall'attributo", () => {
  const cattivo = '" onerror="alert(1)" x="';
  const out = escapeHtml(cattivo);
  assert.ok(!out.includes('"'), 'nessuna virgoletta doppia sopravvive');
  assert.ok(!out.includes('<'));
});

/* ---------------- safeHttpsUrl ---------------- */

test('safeHttpsUrl accetta solo https assoluto', () => {
  assert.ok(safeHttpsUrl('https://esempio.it/a.png'));
  assert.equal(safeHttpsUrl('http://esempio.it/a.png'), null, 'http va rifiutato');
  assert.equal(safeHttpsUrl('/og-image.png'), null, 'relativo va rifiutato');
  assert.equal(safeHttpsUrl('og-image.png'), null);
  assert.equal(safeHttpsUrl('blob:https://esempio.it/abc'), null);
  assert.equal(safeHttpsUrl('data:image/png;base64,AAAA'), null);
  assert.equal(safeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpsUrl(''), null);
  assert.equal(safeHttpsUrl(null), null);
  assert.equal(safeHttpsUrl(42), null);
});

/* ---------------- date ---------------- */

test('data singola con ora', () => {
  assert.equal(formatData('2026-09-06', '', '09:00'), 'domenica 6 settembre 2026, ore 09:00');
});

test('data singola senza ora', () => {
  assert.equal(formatData('2026-09-06', '', ''), 'domenica 6 settembre 2026');
});

test('intervallo nello stesso mese', () => {
  assert.equal(formatData('2026-09-06', '2026-09-07', '09:00'), '6 - 7 settembre 2026');
});

test('intervallo a cavallo di mese e di anno', () => {
  assert.equal(formatData('2026-08-30', '2026-09-01', ''), '30 agosto - 1 settembre 2026');
  assert.equal(formatData('2026-12-30', '2027-01-01', ''), '30 dicembre 2026 - 1 gennaio 2027');
});

test('date non valide non producono stringhe strampalate', () => {
  assert.equal(formatData('boom', '', ''), '');
  assert.equal(formatData('2026-02-31', '', ''), '');
  assert.equal(formatData('', '', ''), '');
  assert.equal(formatData(undefined, undefined, undefined), '');
});

test('dataFine precedente o uguale a data viene ignorata', () => {
  assert.equal(formatData('2026-09-06', '2026-09-06', ''), 'domenica 6 settembre 2026');
  assert.equal(formatData('2026-09-06', '2026-09-01', ''), 'domenica 6 settembre 2026');
});

test("un'ora malformata non finisce nella stringa", () => {
  assert.equal(formatData('2026-09-06', '', '99:99'), 'domenica 6 settembre 2026');
  assert.equal(formatData('2026-09-06', '', 'mattina'), 'domenica 6 settembre 2026');
});

test('luogo ha la precedenza su comune', () => {
  assert.equal(formatLuogo({ luogo: 'Parco Rossi', comune: 'Udine' }), 'Parco Rossi');
  assert.equal(formatLuogo({ comune: 'Udine' }), 'Udine');
  assert.equal(formatLuogo({}), '');
});

test('troncaTesto taglia su confine di parola', () => {
  const out = troncaTesto('parola '.repeat(60), 40);
  assert.ok(out.length <= 40);
  assert.ok(out.endsWith('…'));
});

/* ---------------- slug ---------------- */

function slugDa(href) {
  return leggiSlug(new URL(href));
}

test('slug valido viene accettato tale e quale', () => {
  assert.equal(
    slugDa('https://volleyfvg.it/?torneo=4-volley-on-fire-29-ago-2026'),
    '4-volley-on-fire-29-ago-2026',
  );
});

test('parametro assente o vuoto', () => {
  assert.equal(slugDa('https://volleyfvg.it/'), null);
  assert.equal(slugDa('https://volleyfvg.it/?torneo='), null);
  assert.equal(slugDa('https://volleyfvg.it/?torneo=%20%20'), null);
});

test('slug ostili vengono rifiutati prima di toccare Firestore', () => {
  for (const cattivo of [
    'https://volleyfvg.it/?torneo=../../users/abc',
    'https://volleyfvg.it/?torneo=%2e%2e%2f%2e%2e%2fusers',
    'https://volleyfvg.it/?torneo=tornei/x/y',
    'https://volleyfvg.it/?torneo=a%20b',
    'https://volleyfvg.it/?torneo=<script>',
    'https://volleyfvg.it/?torneo=' + 'a'.repeat(121),
  ]) {
    assert.equal(slugDa(cattivo), null, cattivo);
  }
});

test('i vecchi ID auto-generati di Firestore restano accettati', () => {
  assert.equal(slugDa('https://volleyfvg.it/?torneo=A9Fk7bLc2P'), 'A9Fk7bLc2P');
});

/* ---------------- preview ---------------- */

test('la preview usa nome, data e luogo del torneo', () => {
  const p = buildPreview(TORNEO, '1-madonna-del-bembo-6-set-2026', ENV);
  assert.equal(p.title, '1° Madonna del Bembo');
  assert.equal(p.description, 'domenica 6 settembre 2026, ore 09:00 · Azzano Decimo (PN)');
  assert.equal(p.image, TORNEO.locandina);
  assert.equal(p.url, 'https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026');
});

test("og:url e' esattamente l'URL condiviso, parametro compreso", () => {
  const p = buildPreview(TORNEO, '4-volley-on-fire-29-ago-2026', ENV);
  assert.equal(p.url, 'https://volleyfvg.it/?torneo=4-volley-on-fire-29-ago-2026');
});

test('senza locandina si usa il fallback, con le sue dimensioni', () => {
  const p = buildPreview({ ...TORNEO, locandina: '', locandinaThumb: '' }, 'x', ENV);
  assert.equal(p.image, ENV.FALLBACK_IMAGE);
  assert.deepEqual(p.imageSize, { width: '512', height: '512' });
});

test('con la locandina NON si dichiarano width/height', () => {
  const p = buildPreview(TORNEO, 'x', ENV);
  assert.equal(p.imageSize, null, 'le locandine sono verticali, dichiarare 1200x630 sarebbe falso');
});

test('una locandina relativa o http ricade sul fallback', () => {
  assert.equal(buildPreview({ ...TORNEO, locandina: '/loc.png', locandinaThumb: '' }, 'x', ENV).image, ENV.FALLBACK_IMAGE);
  assert.equal(buildPreview({ ...TORNEO, locandina: 'http://x.it/a.png', locandinaThumb: '' }, 'x', ENV).image, ENV.FALLBACK_IMAGE);
});

test('senza locandina grande si ripiega sul thumb, non sul fallback', () => {
  const p = buildPreview({ ...TORNEO, locandina: '' }, 'x', ENV);
  assert.equal(p.image, TORNEO.locandinaThumb);
});

test('senza data e senza luogo si usa la descrizione generica', () => {
  const p = buildPreview({ nome: 'Torneo', status: 'published' }, 'x', ENV);
  assert.equal(p.description, ENV.FALLBACK_DESCRIPTION);
  assert.notEqual(p.description.trim(), '');
});

/* ---------------- meta tag ---------------- */

test('il blocco contiene tutti i tag richiesti', () => {
  const html = renderMetaTags(buildPreview(TORNEO, 'x', ENV));
  for (const atteso of [
    'property="og:type" content="website"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'property="og:url"',
    'property="og:site_name"',
    'property="og:locale" content="it_IT"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:title"',
    'name="twitter:description"',
    'name="twitter:image"',
    'name="description"',
    'rel="canonical"',
  ]) {
    assert.ok(html.includes(atteso), `manca: ${atteso}`);
  }
});

test('og:image e twitter:image sono assoluti e https', () => {
  const html = renderMetaTags(buildPreview(TORNEO, 'x', ENV));
  for (const m of html.matchAll(/(?:property|name)="(?:og|twitter):image"\s+content="([^"]*)"/g)) {
    assert.ok(m[1].startsWith('https://'), `non https: ${m[1]}`);
  }
});

test("l'URL della locandina resta integro nonostante l'escaping", () => {
  const html = renderMetaTags(buildPreview(TORNEO, 'x', ENV));
  // & diventa &amp; nell'attributo: e' corretto, ed e' cosi' che
  // il browser lo rilegge come &.
  assert.ok(html.includes('alt=media&amp;token=6c903180-3b4a-4c41-b260-efa1e2dc8a9d'));
  assert.ok(!/content="[^"]*&(?!amp;|lt;|gt;|quot;|#39;)/.test(html), 'ampersand nudo in un attributo');
});

test('un torneo ostile non riesce a iniettare HTML', () => {
  const ostile = {
    ...TORNEO,
    nome: '"><script>alert(1)</script><meta property="og:title" content="hacked',
    comune: `Udine" onload="evil()`,
  };
  const html = renderMetaTags(buildPreview(ostile, 'x', ENV));
  assert.ok(!html.includes('<script'), 'tag script iniettato');
  assert.ok(!html.includes('</script>'));
  /* La stringa "onload=" resta visibile nel testo, ma come testo:
     per diventare un handler servirebbe una virgoletta vera che
     chiuda l'attributo, e quella e' diventata &quot;. Cerco quindi
     l'handler nella forma in cui il parser lo riconoscerebbe. */
  assert.ok(!/\son(?:load|error|click)\s*=\s*["']/.test(html), 'handler iniettato');
  assert.ok(html.includes('onload=&quot;'), 'il testo ostile deve sopravvivere, ma neutralizzato');
  /* Nessun attributo `content` viene chiuso in anticipo: fra le
     virgolette di apertura e quelle di chiusura non ci sono altre
     virgolette nude. */
  for (const m of html.matchAll(/content="([^"]*)"/g)) {
    assert.ok(!m[1].includes('"'), 'virgoletta nuda dentro content');
  }
  // Un solo og:title, non due.
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
});

test('nessun dato privato finisce nei meta tag', () => {
  /* Firebase.js non li chiede nemmeno, ma se un giorno la field
     mask cambiasse questo test se ne accorge. */
  const conPrivati = {
    ...TORNEO,
    authorEmail: 'christian.corro@outlook.com',
    authorName: 'Christian Corrò',
    authorId: 'uid-segreto-123',
  };
  const html = renderMetaTags(buildPreview(conPrivati, 'x', ENV));
  assert.ok(!html.includes('outlook.com'));
  assert.ok(!html.includes('uid-segreto-123'));
  assert.ok(!html.toLowerCase().includes('authoremail'));
});
