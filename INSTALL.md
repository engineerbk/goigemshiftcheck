# gói gém — Install & Run on a PC

Standalone setup guide for running the **backend** (FastAPI + MongoDB) and the **frontend** (Expo / React Native) on a regular PC for development or self-hosting. Works on Windows, macOS and Linux.

> This document is updated for the **May 2026** build, which includes:
> shift approval workflow, in-app notifications with bell badge, late check-in / early-leave flagging, monthly working-hours chart, admin override on swap requests + shift reassignment, popup date/time pickers, and flexible shift swap (peer or propose-new).

---

## 1. Prerequisites

Install these once, in any order:

| Tool | Version | Where |
|---|---|---|
| **Python** | 3.11+; 3.14 verified | https://www.python.org/downloads/ (tick "Add Python to PATH") |
| **Node.js** | 20.x LTS or newer | https://nodejs.org/en/download |
| **Yarn** (classic) | 1.22+ | `npm install -g yarn` |
| **MongoDB Community** | 7.x or 8.x | https://www.mongodb.com/try/download/community |
| **Git** | any | https://git-scm.com/downloads |
| **Expo Go** (phone, optional) | latest from your store | iOS App Store / Google Play |
| **Watchman** (macOS only, optional) | latest | `brew install watchman` |

Verify in a terminal:
```bash
python --version      # Python 3.11+; Python 3.14 is supported
node --version        # v20.x
yarn --version        # 1.22.x
mongod --version      # db version v7.x or v8.x
```

> **MongoDB** must be running before you start the backend.
> - Windows: it usually auto-starts as a service after install. Otherwise run `net start MongoDB` from an Admin Command Prompt.
> - macOS (Homebrew): `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb/brew/mongodb-community`
> - Linux (systemd): `sudo systemctl start mongod`

---

## 2. Get the source code

```bash
git clone <YOUR-REPO-URL> goigem
cd goigem
```

Folder layout:
```
goigem/
├── backend/                    # FastAPI + MongoDB API
│   ├── server.py               # all routes (auth, shifts, attendance, swaps, notifications, reports)
│   ├── requirements.txt
│   └── .env                    # you create this (see § 3.2)
├── frontend/                   # Expo / React Native app
│   ├── app/                    # file-based routes (expo-router)
│   │   ├── (tabs)/             # Home / Shifts / Calendar / History / Reports / Admin / Profile
│   │   ├── notifications.tsx
│   │   ├── admin-approvals.tsx
│   │   ├── admin-swaps.tsx
│   │   ├── shift-edit/[id].tsx
│   │   ├── swap/[targetId].tsx
│   │   └── swap-from/[id].tsx  # NEW — peer or propose-new swap
│   ├── src/                    # api client, auth, i18n, theme, components, notifications context
│   ├── assets/images/          # logo + splash
│   ├── package.json
│   └── .env                    # you create this (see § 4.2)
└── INSTALL.md                  # this file
```

---

## 3. Backend setup (FastAPI)

### 3.1. Create a virtual environment & install
```bash
cd backend
python -m venv .venv

# Activate the venv:
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Windows CMD:
.\.venv\Scripts\activate.bat
# macOS / Linux:
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

`requirements.txt` is intentionally a short direct-dependency list. Do not replace it with a full `pip freeze` dump; generated environment dumps can include unused or platform-specific packages that break installs.

The backend uses:

* `fastapi`, `uvicorn` — the API server
* `motor` — async MongoDB driver
* `pydantic v2` — request/response models
* `PyJWT`, `bcrypt` — JWT + password hashing
* `python-dotenv` — loads `backend/.env`
* `openpyxl` — multi-sheet Excel (.xlsx) export
* `pytest`, `requests` — API tests

Notes for Python 3.14:
* `bcrypt==4.3.0` is required; older `bcrypt==4.1.3` can leave a stale native extension and fail to import.
* `motor==3.7.1` is used so PyMongo works cleanly on Python 3.14.

### 3.2. Create `backend/.env`
Create the file `backend/.env` with these values:

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="goigem"
JWT_SECRET="change-me-to-a-long-random-string"
ADMIN_EMAIL="admin@shift.com"
ADMIN_PASSWORD="admin123"
```

Pick a long random `JWT_SECRET`:
```bash
python -c "import secrets;print(secrets.token_hex(32))"
```

> **Important** — change `ADMIN_PASSWORD` for any non-test deployment.

### 3.3. Run the API
```bash
# From the backend/ folder, with the venv active
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

From the project root, use:
```bash
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8001
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
INFO     Seeded admin: admin@shift.com
```

Test it:
```bash
curl http://localhost:8001/api/
# {"message":"Shift Management API"}
```

Leave this terminal running.

### 3.4. API surface (high-level)
All routes are prefixed with `/api`.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Attendance | `POST /attendance/checkin`, `POST /attendance/checkout`, `GET /attendance/status`, `GET /attendance/mine` |
| Shifts (employee) | `POST /shifts`, `GET /shifts/mine`, `GET /shifts/all`, `PATCH /shifts/{id}`, `DELETE /shifts/{id}` |
| Swaps | `POST /swap-requests` (peer or propose-new), `GET /swap-requests`, `POST /swap-requests/{id}/accept`, `POST /swap-requests/{id}/reject` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Admin shifts | `GET /admin/shifts`, `PATCH /admin/shifts/{id}`, `DELETE /admin/shifts/{id}`, `GET /admin/shifts/pending`, `POST /admin/shifts/{id}/approve`, `POST /admin/shifts/{id}/reject`, `POST /admin/shifts/{id}/unapprove` |
| Admin swaps | `GET /admin/swap-requests`, `POST /admin/swap-requests/{id}/force-approve`, `POST /admin/swap-requests/{id}/force-reject` |
| Admin reports | `GET /admin/reports`, `GET /admin/reports/monthly?months=6`, `GET /admin/reports/{user_id}`, `GET /admin/reports.xlsx` |

---

## 4. Frontend setup (Expo)

Open a **second terminal**.

### 4.1. Install JS dependencies
```bash
cd frontend
yarn install
```

### 4.2. Configure `frontend/.env`
Create `frontend/.env` with:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

> If you intend to test from your **phone over Wi-Fi**, replace `localhost` with your PC's LAN IP (e.g. `http://192.168.1.42:8001`). The phone and PC must be on the same network.
> If your network blocks LAN access, use `yarn start --tunnel` (see § 4.3) — it will route traffic through an ngrok subdomain.

### 4.3. Start the dev server
```bash
yarn start
# or, if yarn start is not defined:
npx expo start
```

Expo prints a QR code and a couple of URLs:
- **Web** — press `w` in the terminal, opens at http://localhost:8081
- **iOS Simulator** — press `i` (macOS only, requires Xcode)
- **Android Emulator** — press `a` (requires Android Studio)
- **Physical phone** — open **Expo Go** and scan the QR code

For phones on cellular or restrictive Wi-Fi:
```bash
yarn start --tunnel
# uses ngrok; first launch may ask to install @expo/ngrok
```

---

## 5. First login

The backend automatically seeds an admin account on startup using the values in `backend/.env`:

| Email | Password | Role |
|---|---|---|
| `admin@shift.com` | `admin123` | admin |

Employees register themselves through the **Create account** screen.

> The auth flow uses JWT bearer tokens stored on the device with `expo-secure-store` (mobile) or AsyncStorage. Sessions persist across app restarts.

---

## 6. Feature map (where to find what)

| Feature | Path / file |
|---|---|
| Home (check-in/out, today's status, late banner) | `app/(tabs)/index.tsx` |
| Shifts list (your shifts, swap/edit/delete buttons, approval badge) | `app/(tabs)/shift.tsx` |
| Weekly Calendar (everyone's shifts, action sheet on tap) | `app/(tabs)/calendar.tsx` |
| Attendance History (late / early-leave chips) | `app/(tabs)/history.tsx` |
| Reports (totals + 6-month bar chart + per-employee + Excel) | `app/(tabs)/reports.tsx` |
| Admin dashboard (pending shifts CTA, swap requests CTA) | `app/(tabs)/admin.tsx` |
| Profile + language switch (EN / VI) | `app/(tabs)/profile.tsx` |
| Notifications screen + global bell badge | `app/notifications.tsx` + `src/notifications.tsx` + `src/components/NotificationBell.tsx` |
| Admin shift approvals (Approve / Deny / Revert) | `app/admin-approvals.tsx` |
| Admin swap moderation (Force approve / Force reject) | `app/admin-swaps.tsx` |
| Edit a shift | `app/shift-edit/[id].tsx` |
| Request a swap (peer or propose-new) | `app/swap-from/[id].tsx` |
| Backwards-compat per-target swap | `app/swap/[targetId].tsx` |

### Predefined options (`src/shift-options.ts`)
* **Stores**: 7 fixed locations (e.g. `74 Hàng Nón`, …). Edit this file to change.
* **Shift types**: `morning` (06:00–12:00), `afternoon` (12:00–18:00), `evening` (18:00–24:00).

### i18n (`src/i18n.tsx`)
Strict bilingual EN / VI. Every string used in the UI has an entry in both dictionaries — when you add a new screen, add the strings here too.

---

## 7. Useful commands

### Backend
```bash
# Activate venv first, then:
uvicorn server:app --reload                          # dev mode (auto-reload on save)
uvicorn server:app --host 0.0.0.0 --port 8001        # share on LAN
pip install <pkg> && pip freeze > requirements.txt   # add a dependency
```

### Frontend
```bash
yarn start                          # start Metro / Expo
yarn start --tunnel                 # public ngrok URL (test on cellular)
npx expo start --web                # web only
npx expo install <package>          # add an SDK-compatible package
npx expo install --check            # auto-pin all packages to current Expo SDK
npx expo export --platform web      # build static web bundle to dist/
npx expo prebuild                   # generate ios/ + android/ folders for native builds
```

### MongoDB
```bash
brew services start mongodb/brew/mongodb-community   # macOS Homebrew
brew services list | grep mongodb                    # confirm service status
mongosh --quiet --eval "db.adminCommand({ ping: 1 })" # should print { ok: 1 }

mongosh                                # interactive shell
mongosh goigem                         # use the app DB
> db.users.find().pretty()             # list users
> db.shifts.find().pretty()            # list shifts (incl. approval_status)
> db.attendance.find().pretty()        # check-ins / outs (incl. late_minutes)
> db.notifications.find().pretty()     # in-app notifications
> db.swap_requests.find().pretty()     # peer + new-shift swap requests
```

---

## 8. Production-style run (single PC, no cloud)

For cloud server Docker deployment and Android APK/AAB release builds, use [DEPLOY.md](./DEPLOY.md). The section below is for a simple manual single-machine deployment.

For a small office / personal server:

1. **Backend** — run uvicorn behind a process manager so it restarts on crashes:
   ```bash
   pip install "uvicorn[standard]"
   uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
   ```
   On Linux wrap it in a `systemd` unit; on Windows use **NSSM** or **Task Scheduler**.

2. **Frontend** — build a static web bundle and serve it:
   ```bash
   cd frontend
   npx expo export --platform web   # outputs to dist/
   npx serve dist                   # or any static server (nginx, IIS, caddy)
   ```
   Set `EXPO_PUBLIC_BACKEND_URL` to the public URL of your backend **before** exporting (it's compiled in).

3. **MongoDB** — keep it on the same machine and bind to `127.0.0.1` only, or a private LAN IP. Always set a fresh `JWT_SECRET` and change the admin password.

4. **Reverse proxy (recommended)** — front everything with nginx so:
   * `https://your-domain/api/*` → `http://127.0.0.1:8001`
   * `https://your-domain/*` → static `dist/`
   That way both web and mobile clients use a single HTTPS origin and `EXPO_PUBLIC_BACKEND_URL=https://your-domain` works for everyone.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `pymongo.errors.ServerSelectionTimeoutError` with `Connection refused` | MongoDB is not running on `localhost:27017`. Start it with `brew services start mongodb/brew/mongodb-community` on macOS, `net start MongoDB` on Windows, or `sudo systemctl start mongod` on Linux. |
| `pymongo.errors.ServerSelectionTimeoutError` with `Operation not permitted` | The process is blocked from local socket access. In Codex/sandboxed terminals, rerun the backend with local-network permission. In a normal terminal, check firewall/security software. |
| `mongod not found` | MongoDB is not installed or not on PATH. On macOS: `brew tap mongodb/brew && brew install mongodb-community`. |
| `mongosh --eval "db.adminCommand({ ping: 1 })"` returns `{ ok: 1 }` but backend fails | Verify `backend/.env` has `MONGO_URL="mongodb://localhost:27017"` and restart the backend after MongoDB is running. |
| Backend boots but `/api/auth/me` returns 401 | Restart the backend so the seeded admin row is created, then sign in with the credentials in `.env`. |
| Frontend white screen / "Network request failed" | `EXPO_PUBLIC_BACKEND_URL` in `frontend/.env` is wrong, or the phone can't reach the PC's IP (firewall, different Wi-Fi). Use `yarn start --tunnel`. |
| QR scan opens app then disconnects on phone | Use `yarn start --tunnel` so Expo Go can reach Metro through ngrok. |
| `AsyncStorage: Native module is null` on Expo Go | Library version mismatch. Run `npx expo install --check` and let it pin SDK-correct versions. |
| Excel export download is empty on iOS Safari | iOS blocks blob downloads in some setups; use **Export** → share-sheet → "Save to Files" instead of long-press save. |
| Bell badge stays at the same number | Pull-to-refresh on Notifications, or reopen the app — the count auto-refreshes every 30 s and on foreground. |
| Date/time picker doesn't appear on iOS | Make sure you're on `@react-native-community/datetimepicker` matching the Expo SDK; the popup is a `Modal` — check that `mode` state is being set (TestID: `datetime-picker-modal`). |
| `Approved shifts cannot be cancelled` 400 | This is by design — once admin approves a shift the employee can no longer delete or PATCH it. Use the "Swap" button on Shifts tab, or have admin **Revert approval** from the Calendar action sheet. |
| Swap request created but peer can't accept | If the swap involves any approved shift OR is a propose-new request, the response sets `requires_admin: true` — only an admin can `force-approve` it from `/admin-swaps`. |

---

## 10. Project commands cheat sheet

```bash
# Stop everything: Ctrl+C in each terminal.

# Reset the database (⚠️ deletes all data):
mongosh goigem --eval "db.dropDatabase()"

# Re-seed the admin account: just restart the backend.

# Wipe just notifications (keep users/shifts):
mongosh goigem --eval "db.notifications.deleteMany({})"

# Reset all approval statuses to pending (re-test approval flow):
mongosh goigem --eval 'db.shifts.updateMany({}, {$set: {approval_status: "pending"}})'
```

---

## 11. Updating from an older copy

If you already had this project running and pulled the latest changes, do **all** of the following:

```bash
# Backend
cd backend
source .venv/bin/activate                # or the Windows equivalent
pip install -r requirements.txt          # picks up openpyxl etc.
python -c "import bcrypt, jwt, fastapi, motor, openpyxl, pydantic, dotenv, requests, uvicorn; print('backend deps import ok')"

# Frontend
cd ../frontend
yarn install                             # picks up new packages (e.g. notifications context)
npx expo install --check                 # pin everything to the current Expo SDK
```

Then restart both terminals. The backend will auto-create new collections (`notifications`) and indices on first run; existing shifts without `approval_status` are treated as `pending` until an admin approves them.

---

That's it. Two terminals — backend on **:8001**, Expo on **:8081** — are all you need to develop and test locally. Sign in as `admin@shift.com` / `admin123` to see admin features, or register a new employee account to walk through the regular workflow.
