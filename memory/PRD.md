# ShiftTrack — Product Requirements Document

## Overview
Mobile app (React Native / Expo) for employees to check in/out with GPS and register custom working shifts. Built as an alternative to the Flutter request since this environment is Expo-based.

## Roles
- **Employee** (default on register): can manage own shifts, check in/out, view history, profile.
- **Admin** (pre-seeded): everything employees have + Admin dashboard with stats, employees, attendance & shifts across the company.

## Features
1. **Authentication** — JWT Bearer tokens stored in `AsyncStorage`. Register, login, logout, `/me`.
2. **Check-in/Check-out** — Big primary CTA on Home. Captures GPS (lat/lng) after permission. Cannot check in twice; computes `duration_minutes` on check-out.
3. **Shift Registration** — Custom date + start/end time pickers (`@react-native-community/datetimepicker`) + optional note. List of your shifts with delete.
4. **Work History** — All sessions, total hours, completed count, with GPS badge.
5. **Profile** — User card, role badge, sign-out.
6. **Admin Dashboard** — Live stats (active now, employees, shifts today/total), live attendance feed, employee list, upcoming shifts.

## Backend (FastAPI + MongoDB, UUID ids)
- `POST /api/auth/register | /login`, `GET /api/auth/me`
- `POST /api/shifts`, `GET /api/shifts/mine`, `DELETE /api/shifts/{id}`
- `GET /api/attendance/status`, `POST /api/attendance/checkin | /checkout`, `GET /api/attendance/mine`
- Admin: `GET /api/admin/{employees,attendance,shifts,stats}`

## Design
Swiss high-contrast corporate — primary `#0052FF`, white background, `Ionicons`, pill buttons, rounded cards, 44pt+ touch targets, safe-area aware, KeyboardAvoidingView on forms.

## Testing Status
Backend: 19/19 endpoints pass (pytest via public URL). Frontend: login screen rendered; e2e flow not yet exercised by testing agent.

## Credentials
- Admin (seeded): `admin@shift.com` / `admin123`
- Employees: register via the app.
