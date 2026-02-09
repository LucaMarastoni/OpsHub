# Personal Ops Hub (Raspberry)

Hub operativo leggero (Node + SQLite) per note, todo, promemoria e link. Pensato per girare su Raspberry Pi in locale, UI minimale e mobile-first.

## Funzionalità
- Dashboard con quick-add smart e overview.
- CRUD per Todo (priorità, stato, scadenze), Note markdown, Promemoria, Link.
- Ricerca globale (FTS5 se disponibile, fallback LIKE).
- Tag ovunque, filtri rapidi, scorciatoie da tastiera (`/`, `n`, `t`).
- Basic Auth opzionale via `.env`.

## Stack
- Backend: Node.js + Express
- DB: SQLite (file locale, creato automaticamente)
- Templating: EJS, Tailwind CDN, JS vanilla

## Requisiti
- Node.js 18+ (consigliato 20) installato sul Raspberry.
- Git e SQLite presenti di default su molte distro.

### Installare Node su Raspberry Pi OS
```bash
# usa il repo ufficiale NodeSource (esempio per Node 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
```

## Setup locale / sviluppo
```bash
cp .env.example .env        # imposta PORT, DATABASE_PATH, credenziali opzionali
npm install
npm run dev                 # nodemon, default su http://localhost:3000
```
Il file SQLite viene creato in `db/data.sqlite` al primo avvio.

## Avvio produzione (systemd)
1. Configura `.env` (PORT, DATABASE_PATH, ADMIN_USER/ADMIN_PASS se vuoi basic auth).
2. Installa le dipendenze: `npm install --production`.
3. Crea un service file, es. `/etc/systemd/system/opshub.service`:
```ini
[Unit]
Description=Personal Ops Hub
After=network.target

[Service]
WorkingDirectory=/path/to/luchub
Environment=NODE_ENV=production
EnvironmentFile=/path/to/luchub/.env
ExecStart=/usr/bin/node /path/to/luchub/src/server.js
Restart=always
User=pi
Group=pi

[Install]
WantedBy=multi-user.target
```
4. Avvia e abilita:
```bash
sudo systemctl daemon-reload
sudo systemctl enable opshub
sudo systemctl start opshub
sudo systemctl status opshub
```

## Reverse proxy nginx (opzionale)
Blinda su loopback e passa tramite nginx:
```nginx
server {
  listen 80;
  server_name ops.local;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```
Riavvia nginx: `sudo systemctl reload nginx`.

## Variabili ambiente
- `PORT` (default 3000)
- `DATABASE_PATH` (default `./db/data.sqlite`)
- `ADMIN_USER` / `ADMIN_PASS` abilita Basic Auth se valorizzati
- `NODE_ENV` opzionale

## Comandi npm
- `npm run dev` – nodemon con reload
- `npm start` – avvio semplice
- `npm run lint` – eslint standard

## Shortcut & UX
- `/` mette a fuoco la barra di ricerca.
- `n` nuova nota, `t` nuovo todo.
- Quick-add capisce: `todo compra latte domani 18:00 #spesa`, `note idea progetto #tesi`, `link https://example.com #ref`, `remind chiama mamma domani 19:00`.

## Note su FTS
Il codice tenta di creare la tabella FTS5. Se SQLite non è compilato con FTS5, la ricerca passa automaticamente a LIKE (più lenta ma funziona).

## Sicurezza base
- Helmet abilitato (CSP disattivato per usare CDN Tailwind).
- Rate limit minimo (200 req/5min) lato app.
- Output markdown sanificato server-side.

## Struttura cartelle
```
src/
  server.js
  db/
    index.js, init.js
  routes/
  utils/
views/              # EJS
public/js/app.js    # shortcuts, sidebar toggle
db/                 # conterrà il file SQLite
```

## Backup rapido
Il DB è un singolo file: basta copiare `db/data.sqlite` (e WAL/shm se aperto) per il backup.
