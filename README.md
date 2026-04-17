# USC Centralized Routing System

A full-stack grievance and information routing platform for the University of San Carlos. Students submit campus concerns tagged by department; those concerns are routed to the appropriate admin dashboard, upvoted by peers to surface urgency, and tracked through Pending → Under Review → Resolved.

---

## Stack

| Layer            | Technology                                                    |
| ---------------- | ------------------------------------------------------------- |
| Frontend         | React 18 + Vite 5, React Router 6                             |
| Backend          | Node.js 18+ / Express 4                                       |
| Database         | PostgreSQL 14+                                                |
| Auth             | Google OAuth (ID-token flow) → JWT, domain-restricted to `@usc.edu.ph` |
| Hosting (API+DB) | Railway                                                       |
| Hosting (SPA)    | Any static host — instructions below cover Vercel + `rovelportfolio.com` |

---

## Feature checklist (matches spec)

- **Crowdsourced prioritization** — toggle-upvote per ticket. The `upvotes` table has a composite primary key `(ticket_id, user_id)` so the database itself blocks duplicate voting. A trigger keeps `tickets.upvote_count` in sync.
- **Targeted routing** — every ticket carries one of four mandatory categories: `Academic`, `Facilities`, `Admin/Registrar`, `IT Services`. Each admin is assigned a category via env config, and the admin dashboard filters to that category only.
- **Visible accountability** — three status values with distinct UI badges (`Pending`, `Under Review`, `Resolved`). Only admins whose department matches the ticket's category can change status; both the API and UI enforce this.
- **Official responses** — the `is_official_admin_response` flag is computed **server-side** based on the author's role and category match. Students cannot forge it. The UI pins official responses at the top of the thread and highlights them with a gold border.

---

## Repo layout

```
usc-routing/
├── backend/
│   ├── src/
│   │   ├── config/        db.js, admins.js
│   │   ├── middleware/    auth.js, admin.js, error.js
│   │   ├── controllers/   authController.js, ticketsController.js, responsesController.js
│   │   ├── routes/        auth.js, tickets.js
│   │   ├── db/            schema.sql
│   │   └── server.js
│   ├── .env.example
│   ├── package.json
│   └── railway.json
├── frontend/
│   ├── src/
│   │   ├── api/           client.js
│   │   ├── context/       AuthContext.jsx
│   │   ├── components/    Navbar, ProtectedRoute, TicketCard, Badges
│   │   ├── pages/         Login, Feed, Submit, MyConcerns, TicketDetail, AdminDashboard
│   │   ├── styles/        index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## API surface

| Method | Path                        | Auth            | Purpose                                                  |
| ------ | --------------------------- | --------------- | -------------------------------------------------------- |
| POST   | `/auth/login`               | —               | Verify Google ID token, enforce domain, issue JWT        |
| GET    | `/auth/me`                  | Bearer          | Return the current user                                  |
| GET    | `/tickets`                  | optional Bearer | List tickets; `?sort=upvotes|date`, `?category=`, `?status=`, `?mine=true` |
| GET    | `/tickets/:id`              | optional Bearer | Single ticket + all responses                            |
| POST   | `/tickets`                  | Bearer          | Create a ticket                                          |
| POST   | `/tickets/:id/upvote`       | Bearer          | Toggle upvote (add if absent, remove if present)         |
| PUT    | `/tickets/:id/status`       | Admin + category match | Change status                                     |
| POST   | `/tickets/:id/respond`      | Bearer          | Post a comment; automatically marked official when author is a matching-category admin |
| GET    | `/health`                   | —               | DB ping for Railway health checks                        |

---

## Local development

### 1. Prerequisites

- Node.js 18+
- A running PostgreSQL instance (local install, Docker, or a Railway DB with `DATABASE_URL` copied locally)
- A Google OAuth Client ID (see setup below)

### 2. Google OAuth setup

1. Open the [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Add authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://rovelportfolio.com`
   - `https://www.rovelportfolio.com`
4. Authorized redirect URIs can be left empty — we use the implicit ID-token flow via `@react-oauth/google`, not a server redirect.
5. Copy the **Client ID** into both backend `.env` (`GOOGLE_CLIENT_ID`) and frontend `.env` (`VITE_GOOGLE_CLIENT_ID`). They must match.

### 3. Backend

```bash
cd backend
cp .env.example .env
# Fill in: DATABASE_URL, GOOGLE_CLIENT_ID, JWT_SECRET, ADMIN_CONFIG
npm install
npm run db:init        # applies schema.sql against $DATABASE_URL
npm run dev            # starts on :4000
```

Generate a strong JWT secret:

```bash
openssl rand -hex 64
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env
# Fill in: VITE_API_URL=http://localhost:4000, VITE_GOOGLE_CLIENT_ID=...
npm install
npm run dev            # starts on :5173
```

Open [http://localhost:5173](http://localhost:5173), sign in with a `@usc.edu.ph` Google account, and you're in.

### 5. Testing admin behavior locally

The admin assignment is driven by `ADMIN_CONFIG` in the backend env. Example:

```
ADMIN_CONFIG=rovel.lumapas@usc.edu.ph:IT Services,karen.whoever@usc.edu.ph:Academic
```

When `rovel.lumapas@usc.edu.ph` logs in, the upsert in `authController.login` will set `role='admin'`, `admin_category='IT Services'`, and the JWT will carry both — so the Admin tab appears in the nav immediately.

---

## Deployment

### Backend + database — Railway

1. Push this repo to GitHub.
2. On [Railway](https://railway.com), create a new project → **Deploy from GitHub repo** → select your repo → set **Root Directory** to `backend`.
3. In the same project, click **+ New → Database → Add PostgreSQL**. Railway auto-populates `DATABASE_URL` into your service variables.
4. Set the remaining variables on the backend service:
   - `NODE_ENV=production`
   - `GOOGLE_CLIENT_ID=<your id>`
   - `JWT_SECRET=<openssl rand -hex 64>`
   - `JWT_EXPIRES_IN=7d`
   - `ALLOWED_EMAIL_DOMAIN=usc.edu.ph`
   - `CORS_ORIGINS=https://rovelportfolio.com,https://www.rovelportfolio.com`
   - `ADMIN_CONFIG=<email:category pairs>`
5. Under the backend service → **Settings → Networking**, click **Generate Domain** to get a public URL (e.g. `usc-routing-api.up.railway.app`).
6. Initialize the schema once against the production DB. Easiest option:
   ```bash
   # From your local machine, using the Railway "Connect" URL:
   psql "$RAILWAY_DATABASE_URL" -f backend/src/db/schema.sql
   ```
   Or run `npm run db:init` from a Railway shell.
7. Verify: `curl https://<your-api>.up.railway.app/health` → `{"status":"ok"}`.

### Frontend — Vercel + `rovelportfolio.com`

Railway can also host the frontend as a static site, but Vercel is simpler for SPAs and lets you reuse the `rovelportfolio.com` domain you already own.

1. On [Vercel](https://vercel.com), **Add New → Project** → import the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Environment variables:
   - `VITE_API_URL=https://<your-railway-api>.up.railway.app`
   - `VITE_GOOGLE_CLIENT_ID=<your id>`
5. Deploy. Vercel gives you a `*.vercel.app` URL.

### Custom DNS for `rovelportfolio.com`

In your domain registrar's DNS dashboard (whoever you bought `rovelportfolio.com` from — Namecheap, Cloudflare, etc.):

If the routing system should live at the **apex** (`rovelportfolio.com`):

| Type  | Host | Value                |
| ----- | ---- | -------------------- |
| A     | @    | `76.76.21.21` (Vercel's apex IP) |
| CNAME | www  | `cname.vercel-dns.com.` |

If it should live on a **subdomain** (recommended, so your portfolio can stay on the apex — e.g. `routing.rovelportfolio.com`):

| Type  | Host    | Value                  |
| ----- | ------- | ---------------------- |
| CNAME | routing | `cname.vercel-dns.com.` |

Then in Vercel → project → **Settings → Domains**, add the domain. Vercel will issue a Let's Encrypt certificate automatically once DNS propagates (usually under 5 minutes).

### Post-deploy checklist

- [ ] `GET /health` on the Railway API returns `{"status":"ok"}`
- [ ] Google OAuth origins include the final Vercel domain (`https://rovelportfolio.com`) — otherwise the sign-in popup silently fails
- [ ] `CORS_ORIGINS` on Railway includes the Vercel domain
- [ ] Schema has been applied (`SELECT * FROM users;` works)
- [ ] A test login with a `@usc.edu.ph` account creates a row in `users`
- [ ] At least one `ADMIN_CONFIG` entry is set and that admin sees the Admin tab after logging in

---

## Security notes

- **Domain enforcement** happens in `authController.login` using the email in the Google-verified ID token — not the client. The `hd="usc.edu.ph"` prop on the Google button is only a UX hint; the real check is server-side.
- **Role escalation** is impossible from the client: `role` and `admin_category` come from the `users` table, which is only writable by the backend during the OAuth upsert. The JWT encodes them but the backend re-derives them on login every time from `ADMIN_CONFIG`, so removing an admin from env cleanly downgrades them on next login.
- **Official response spoofing** is blocked: `responsesController.createResponse` ignores any `is_official_admin_response` the client sends and computes it from the server-side user role.
- **Cross-category admin actions** are blocked in both `updateStatus` (status change) and `createResponse` (official flag) via `adminCanActOnCategory`.
- **SQL injection** is not possible: every query uses parameterized `$n` placeholders. The only dynamic SQL is the sort column and order, both pinned to a whitelist (`SORTABLE_COLUMNS`, `asc|desc`).
- **Duplicate voting** is blocked at the database layer by the composite primary key on `upvotes`. The controller's transactional toggle is belt-and-suspenders against races.

---

## License

Built for USC academic use. Re-use freely with attribution.
