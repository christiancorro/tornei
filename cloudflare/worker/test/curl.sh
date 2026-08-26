#!/usr/bin/env bash
# ---------------------------------------------------------
# Verifica end-to-end con curl.
#
#   ./test/curl.sh                                   # wrangler dev
#   ./test/curl.sh https://<nome>.workers.dev        # staging
#   ./test/curl.sh https://volleyfvg.it              # produzione
#
# Secondo argomento: lo slug di un torneo pubblicato con
# locandina. Default: il primo della sitemap.
#
# Gli User-Agent qui sotto sono un'approssimazione: WhatsApp e
# Telegram cambiano stringa spesso e non sono gli unici a
# chiedere la pagina. Servono a verificare che il Worker
# risponda, non a dimostrare che la preview e' perfetta — per
# quella ci sono gli strumenti ufficiali elencati in
# docs/social-preview.md.
# ---------------------------------------------------------
set -uo pipefail

BASE="${1:-http://localhost:8787}"
SLUG="${2:-1-madonna-del-bembo-6-set-2026}"
BASE="${BASE%/}"

ok=0; ko=0
verde() { printf '  \033[32mOK\033[0m   %s\n' "$1"; ok=$((ok+1)); }
rosso() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; ko=$((ko+1)); }

# atteso_in <descrizione> <ago> <corpo>
atteso_in() {
  if grep -qF -- "$2" <<<"$3"; then verde "$1"; else rosso "$1 (manca: $2)"; fi
}
atteso_non_in() {
  if grep -qF -- "$2" <<<"$3"; then rosso "$1 (presente: $2)"; else verde "$1"; fi
}
stato() {
  if [ "$2" = "$3" ]; then verde "$1 -> $2"; else rosso "$1 -> $2 (atteso $3)"; fi
}

# scarica <url> [user-agent] -> imposta CODE, CTYPE, HDRS, BODY
scarica() {
  local url="$1" ua="${2:-}" tmp
  tmp="$(mktemp -d)"
  if [ -n "$ua" ]; then
    curl -sS -A "$ua" -D "$tmp/h" -o "$tmp/b" -w '%{http_code}' "$url" >"$tmp/c" 2>"$tmp/e"
  else
    curl -sS -D "$tmp/h" -o "$tmp/b" -w '%{http_code}' "$url" >"$tmp/c" 2>"$tmp/e"
  fi
  CODE="$(cat "$tmp/c" 2>/dev/null || echo 000)"
  HDRS="$(cat "$tmp/h" 2>/dev/null || true)"
  BODY="$(cat "$tmp/b" 2>/dev/null || true)"
  CTYPE="$(grep -i '^content-type:' <<<"$HDRS" | tail -1 | tr -d '\r')"
  rm -rf "$tmp"
}

echo
echo "Base: $BASE"
echo "Slug: $SLUG"
echo

# --- 1. GET / ------------------------------------------------
echo "1. GET /  (il sito, come sempre)"
scarica "$BASE/"
stato "status" "$CODE" "200"
atteso_in "content-type html" "text/html" "$CTYPE"
atteso_in "l'app React c'e'" '<div id="root">' "$BODY"
atteso_in "og:title generico" 'content="Tornei Volley FVG"' "$BODY"
echo

# --- 2. GET /?torneo=<valido> -------------------------------
echo "2. GET /?torneo=$SLUG"
scarica "$BASE/?torneo=$SLUG"
stato "status" "$CODE" "200"
atteso_in "content-type html" "text/html" "$CTYPE"
atteso_in "og:type"        'property="og:type" content="website"' "$BODY"
atteso_in "og:title"       'property="og:title"' "$BODY"
atteso_in "og:description" 'property="og:description"' "$BODY"
atteso_in "og:image"       'property="og:image"' "$BODY"
atteso_in "og:url"         "property=\"og:url\" content=\"https://volleyfvg.it/?torneo=$SLUG\"" "$BODY"
atteso_in "twitter:card"   'name="twitter:card" content="summary_large_image"' "$BODY"
atteso_in "canonical"      'rel="canonical"' "$BODY"
atteso_in "og:image assoluto https" 'property="og:image" content="https://' "$BODY"
atteso_non_in "nessuna immagine relativa" 'content="/og-image.png"' "$BODY"
atteso_non_in "nessuna email dell'autore" '@' "$(grep -o '<meta[^>]*>' <<<"$BODY" | grep -i 'og:\|twitter:' || true)"
atteso_in "la SPA e' ancora li'" '<div id="root">' "$BODY"
# Un solo og:title: i tag generici devono essere stati rimossi.
n=$(grep -o 'property="og:title"' <<<"$BODY" | wc -l | tr -d ' ')
if [ "$n" = "1" ]; then verde "un solo og:title"; else rosso "og:title duplicato ($n)"; fi
echo "  --- valori estratti ---"
grep -oE '<title>[^<]*</title>' <<<"$BODY" | head -1 | sed 's/^/  /'
grep -oE '<meta (property|name)="(og|twitter):[a-z:]+" content="[^"]*">' <<<"$BODY" | sed 's/^/  /'
echo

# --- 3. GET /?torneo=<inesistente> --------------------------
echo "3. GET /?torneo=torneo-che-non-esiste"
scarica "$BASE/?torneo=torneo-che-non-esiste"
stato "status (mai 5xx)" "$CODE" "200"
atteso_in "content-type html" "text/html" "$CTYPE"
atteso_in "preview generica" 'content="Tornei Volley FVG"' "$BODY"
atteso_in "il sito funziona" '<div id="root">' "$BODY"
echo

# --- 4. GET /?torneo= (vuoto) -------------------------------
echo "4. GET /?torneo=  (parametro vuoto)"
scarica "$BASE/?torneo="
stato "status" "$CODE" "200"
atteso_in "il sito funziona" '<div id="root">' "$BODY"
echo

# --- 5. crawler ---------------------------------------------
echo "5. GET /?torneo=$SLUG con User-Agent di crawler"
for ua in \
  "WhatsApp/2.23.20.0 A" \
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" \
  "TelegramBot (like TwitterBot)" \
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "UnCrawlerCheNonEsiste/1.0"
do
  scarica "$BASE/?torneo=$SLUG" "$ua"
  if [ "$CODE" = "200" ] && grep -q 'property="og:image" content="https://' <<<"$BODY"; then
    verde "${ua:0:40}"
  else
    rosso "${ua:0:40} (status $CODE)"
  fi
done
echo "  (nota: anche l'UA inventato deve passare — la preview non dipende dalla lista)"
echo

# --- 6. browser ---------------------------------------------
echo "6. GET /?torneo=$SLUG con User-Agent di browser"
scarica "$BASE/?torneo=$SLUG" \
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
stato "status" "$CODE" "200"
atteso_in "riceve la SPA completa" '<div id="root">' "$BODY"
atteso_in "riceve gli stessi meta tag" 'property="og:image" content="https://' "$BODY"
echo

# --- 7. asset e proxy ---------------------------------------
echo "7. Proxy verso GitHub Pages"
scarica "$BASE/robots.txt"
stato "robots.txt" "$CODE" "200"
atteso_in "contenuto giusto" "User-agent" "$BODY"
scarica "$BASE/manifest.webmanifest"
stato "manifest" "$CODE" "200"
scarica "$BASE/sitemap.xml"
stato "sitemap" "$CODE" "200"
# Il primo <script src> dell'HTML: deve essere servito davvero.
scarica "$BASE/"
asset="$(grep -oE 'src="[^"]*assets/[^"]+\.js"' <<<"$BODY" | head -1 | sed 's/^src="//; s/"$//; s|^\./|/|')"
if [ -n "$asset" ]; then
  scarica "$BASE${asset}"
  stato "asset JS ($asset)" "$CODE" "200"
  atteso_in "content-type javascript" "javascript" "$CTYPE"
else
  echo "  --   nessun asset hashato trovato (normale in wrangler dev su sorgenti non buildate)"
fi
echo

# --- 8. cache ------------------------------------------------
echo "8. Cache"
scarica "$BASE/?torneo=$SLUG"
atteso_in "Cache-Control s-maxage" "s-maxage=" "$HDRS"
atteso_in "Cache-Control max-age=0 per i browser" "max-age=0" "$HDRS"
grep -i '^x-vfvg-worker:' <<<"$HDRS" | tr -d '\r' | sed 's/^/  /'
echo "  (seconda richiesta: x-vfvg-worker deve diventare preview-cache)"
scarica "$BASE/?torneo=$SLUG"
grep -i '^x-vfvg-worker:' <<<"$HDRS" | tr -d '\r' | sed 's/^/  /'
echo

# --- 9. curl -I ----------------------------------------------
echo "9. curl -I (HEAD)"
head_out="$(curl -sSI "$BASE/?torneo=$SLUG" 2>/dev/null || true)"
code="$(head -1 <<<"$head_out" | awk '{print $2}')"
stato "status" "${code:-000}" "200"
atteso_in "content-type html" "text/html" "$head_out"
echo

echo "-----------------------------------------"
printf 'OK: %d   FAIL: %d\n' "$ok" "$ko"
echo "-----------------------------------------"
[ "$ko" -eq 0 ]
