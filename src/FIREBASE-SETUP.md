# Backend Firebase — guida di setup

Non c'è un server da scrivere: Firestore *è* il backend, e le regole di
sicurezza sono la logica di autorizzazione. Segui i passi in ordine.

## 1. Crea il progetto

1. [console.firebase.google.com](https://console.firebase.google.com) → **Aggiungi progetto**
2. **Build → Authentication → Get started → Email/Password → Abilita**
   (lascia disattivato "Link email senza password")
3. **Build → Firestore Database → Crea database** → modalità **produzione**,
   località `eur3 (europe-west)` — sei in Italia, tienici i dati vicino
4. **Build → Storage → Get started** (serve solo se carichi le locandine come file)
5. **Impostazioni progetto → Le tue app → `</>` Web** → registra l'app e copia il config

## 2. Collega il frontend

```bash
npm install firebase
cp .env.example .env     # poi incolla dentro i valori del punto 1.5
```

Riavvia `npm run dev`: Vite legge le variabili `VITE_*` solo all'avvio.

## 3. Pubblica le regole

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # scegli il progetto
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

Oppure incolla a mano il contenuto di `firestore.rules` in
**Firestore → Regole** e di `storage.rules` in **Storage → Regole**.

## 4. Crea il tuo account organizzatore

1. **Authentication → Users → Add user**: email + password
2. Copia lo **User UID**
3. **Firestore → Avvia raccolta** → ID raccolta `admins` → ID documento =
   quell'UID → un campo qualsiasi (es. `email`)

Il documento vuoto in `admins/{uid}` *è* il permesso. Nessun campo
`isAdmin: true` sull'utente, che sarebbe modificabile dal client.

## 5. Importa i dati di esempio (facoltativo)

```bash
npm install firebase-admin
# Impostazioni progetto → Account di servizio → Genera nuova chiave privata
# salvala come serviceAccount.json nella root
node scripts/seed.mjs
```

Aggiungi `serviceAccount.json` e `.env` al `.gitignore`: **quella chiave sì
che è un segreto**, dà accesso completo al progetto ignorando le regole.

---

## Cosa è cambiato nel codice

| File | Cosa fa |
|---|---|
| `src/firebase.js` | Inizializza Auth, Firestore, Storage |
| `src/services/auth.js` | Login, logout, controllo admin, messaggi di errore in italiano |
| `src/services/tournaments.js` | CRUD tornei + upload locandine |
| `src/services/annunci.js` | CRUD bacheca |
| `src/hooks/useAuth.js` | Sostituisce `useState(false)` per `isAdmin` |
| `src/hooks/useTournaments.js` | Sostituisce `useState(INITIAL_TOURNAMENTS)` |
| `src/hooks/useAnnunci.js` | Sostituisce `useState(INITIAL_ANNUNCI)` |
| `src/components/LoginModal.jsx` | Nuovo — form di accesso |
| `src/app.jsx` | Modificato — usa gli hook, handler `async` |
| `src/components/Header.jsx` | Modificato — il toggle finto ora fa login/logout vero |
| `firestore.rules` | **L'autorizzazione vera** |

`src/data.js` non viene più importato dall'app: resta solo come sorgente
per il seed.

## Dettagli che vale la pena conoscere

**`onSnapshot`, non `getDocs`.** I servizi usano listener in tempo reale.
Quando salvi un torneo non aggiorno lo stato locale a mano: la scrittura
va su Firestore, Firestore rimanda indietro la lista, la UI si aggiorna.
Una sola fonte di verità, e due organizzatori collegati insieme vedono le
stesse cose senza refresh.

**Filtri lato client.** Tutti i filtri (`useMemo` in `app.jsx`) continuano
a girare sul browser. Per qualche centinaio di tornei è la scelta giusta:
un solo listener, zero query composite, ricerca testuale libera che
Firestore da solo non sa fare. Oltre il migliaio di documenti conviene
spostare almeno il filtro data lato server con `where('data', '>=', ...)`.

**Le regole validano i campi.** `validTorneo()` controlla formato date,
disciplina, provincia e lunghezze massime. Un admin con la console aperta
non può comunque inserire spazzatura che rompe `formatDataLunga()`.

**Le locandine.** `uploadLocandina(file)` è pronta in
`services/tournaments.js` ma il form usa ancora il campo URL. Per
collegarla serve un `<input type="file">` in `TournamentForm.jsx` che
salvi `locandina` (l'URL) e `locandinaPath` (per cancellare il file
insieme al torneo).

## Prossimi passi possibili

- **Emulatori** (`firebase emulators:start`) per sviluppare senza toccare i dati veri
- **Bacheca aperta**: in `firestore.rules` sostituisci `isAdmin()` con
  `isSignedIn()` nella `create` di `/annunci`, aggiungi `authorId` al
  documento e permetti la delete al solo autore
- **App Check** contro l'abuso automatizzato quando vai online
- **Hosting**: `npm run build && firebase deploy --only hosting`
