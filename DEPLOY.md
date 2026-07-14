# Cloud Server And Mobile Build Guide

This guide covers two deliverables:

- Cloud server install: FastAPI backend, MongoDB, and Expo web static build.
- Mobile install files: Android APK/AAB and iOS/iPadOS IPA through EAS Build.

## 1. Cloud Server Build

Use a Linux VPS with Docker and Docker Compose installed.

For AWS, use the EC2 walkthrough in [deployment/AWS_EC2.md](./deployment/AWS_EC2.md). It covers the recommended Security Group, Elastic IP, Docker setup, same-origin Expo web build, Compose startup, HTTPS options, updates, backups, and troubleshooting.

### 1.1. Configure Server Environment

```bash
cd deployment
cp .env.example .env
```

Edit `deployment/.env`:

```bash
MONGO_URL=mongodb://mongo:27017
DB_NAME=goigem
JWT_SECRET=<long-random-secret>
ADMIN_EMAIL=admin@shift.com
ADMIN_PASSWORD=<strong-admin-password>
```

Generate a secret:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 1.2. Build Frontend Web For Your Domain

Recommended production flow: build the frontend on the same server that runs Docker Compose, for example the AWS EC2 instance. The `web` container serves files from `frontend/dist`, so that directory must exist on the server before starting the stack.

This repo uses Yarn 1 and the committed `frontend/yarn.lock`. Do not run `npm install expo` or mix npm with Yarn inside `frontend`; that can downgrade Expo packages and create dependency conflicts such as `react-native-screens`.

The frontend compiles `EXPO_PUBLIC_BACKEND_URL` into the app. For the included Nginx same-origin deployment, build without loading a local `.env` so browser requests go to `/api` on the same domain:

```bash
cd frontend
rm -rf node_modules package-lock.json
corepack enable
yarn install --frozen-lockfile
EXPO_NO_DOTENV=1 EXPO_PUBLIC_BACKEND_URL=http://52.64.160.45/ npx expo export --platform web
```

If the backend is hosted on another origin, set that public HTTPS origin before exporting:

```bash
EXPO_PUBLIC_BACKEND_URL=https://shift.example.com npx expo export --platform web
```

The static site is written to `frontend/dist`.

If you build on your PC instead, upload the generated `frontend/dist` directory to the EC2 server at the same repo path before running Docker Compose. Building directly on EC2 is simpler because it avoids copying build artifacts after every release.

### 1.3. Start Server Stack

```bash
cd deployment
docker compose up -d --build
```

Check health:

```bash
docker compose ps
curl http://127.0.0.1/api/
```

Expected response:

```json
{"message":"Shift Management API"}
```

### 1.4. Add HTTPS

For production, put Cloudflare, Caddy, Traefik, or an Nginx reverse proxy with Let's Encrypt in front of this stack.

The included compose file publishes HTTP on port `80`. HTTPS termination can be done outside this compose stack, or by replacing `deployment/nginx.conf` with your TLS configuration.

## 2. Mobile Builds

This repo uses Expo managed workflow. The practical production build path is EAS Build.

### 2.1. Install EAS CLI

```bash
cd frontend
npm install -g eas-cli
eas login
```

### 2.2. Update Backend URL

Edit `frontend/eas.json` and replace:

```json
"EXPO_PUBLIC_BACKEND_URL": "https://your-domain.example"
```

with your actual HTTPS backend origin.

### 2.3. Build APK For Direct Install

```bash
cd frontend
eas build --platform android --profile preview-apk
```

EAS returns a download URL for an `.apk` file. Use this for direct Android installation/testing.

### 2.4. Build AAB For Play Store

```bash
cd frontend
eas build --platform android --profile production-aab
```

EAS returns an `.aab` file for Google Play Console upload.

### 2.5. Build IPA For iOS / iPadOS Internal Install

This requires an Apple Developer account. For installable `.ipa` testing outside the App Store, use the internal profile:

```bash
cd frontend
eas build --platform ios --profile ios-ipa
```

EAS will ask for Apple credentials and provisioning setup if they are not already configured. The resulting `.ipa` can be installed only on provisioned devices for internal/ad-hoc distribution.

### 2.6. Build iOS Simulator App Without Apple Developer Account

You cannot create an installable iPhone/iPad `.ipa` without Apple signing credentials. If you do not have an Apple Developer account, build for the iOS Simulator instead:

```bash
cd frontend
yarn install --frozen-lockfile
eas build --local --platform ios --profile ios-simulator
```

This requires macOS with Xcode installed. The output is for the iOS Simulator only, not for installation on a physical iPhone/iPad.

For quick device testing without an `.ipa`, use Expo Go:

```bash
cd frontend
yarn start --tunnel
```

Then scan the QR code with Expo Go on the iPhone.

### 2.7. Build iOS / iPadOS For App Store

```bash
cd frontend
eas build --platform ios --profile ios-production
```

This produces an App Store distribution build. Submit it with:

```bash
eas submit --platform ios
```

## 3. Release Checklist

Before publishing a build:

```bash
python3 -m compileall -q backend backend_test.py tests
cd frontend
rm -rf node_modules package-lock.json
corepack enable
yarn install --frozen-lockfile
npx tsc --noEmit
yarn lint
```

Then:

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_BACKEND_URL= npx expo export --platform web
cd ../deployment
docker compose up -d --build
```
