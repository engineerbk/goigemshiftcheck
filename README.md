# gói gém Shift Check-in

Mobile-first shift check-in app for employees and admins.

Core stack:
- Backend: FastAPI, MongoDB, JWT auth
- Frontend: Expo / React Native, expo-router
- Local backend: `http://127.0.0.1:8001`
- Local Expo dev server: `http://localhost:8081`

Start locally:
```bash
# 1. Start MongoDB
brew services start mongodb/brew/mongodb-community

# 2. Start backend
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8001

# 3. Start frontend
cd frontend
yarn start
```

Full setup, troubleshooting, and update steps are in [INSTALL.md](./INSTALL.md).

Cloud server deployment and Android APK/AAB build instructions are in [DEPLOY.md](./DEPLOY.md).
