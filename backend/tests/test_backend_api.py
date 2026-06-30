"""Backend API tests for Shift Management System.

Covers auth (register/login/me), shifts CRUD, attendance (checkin/checkout/status),
and admin endpoints (RBAC).
"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    # Fallback to reading frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@shift.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def employee():
    """Register a fresh employee and return token+user."""
    email = f"test_emp_{uuid.uuid4().hex[:8]}@shift.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": "Test Emp"}, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    d = r.json()
    return {"token": d["token"], "user": d["user"], "email": email, "password": "testpass123"}


def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_register_returns_token_and_user(self, employee):
        assert "token" in employee and employee["token"]
        assert employee["user"]["role"] == "employee"
        assert employee["user"]["email"] == employee["email"]
        assert "id" in employee["user"]

    def test_register_duplicate_email_fails(self, employee):
        r = requests.post(f"{API}/auth/register", json={"email": employee["email"], "password": "x12345", "name": "Dup"}, timeout=15)
        assert r.status_code == 400

    def test_login_admin_seeded(self, admin_token):
        assert admin_token

    def test_login_registered_user(self, employee):
        r = requests.post(f"{API}/auth/login", json={"email": employee["email"], "password": employee["password"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == employee["email"]

    def test_login_bad_password(self, employee):
        r = requests.post(f"{API}/auth/login", json={"email": employee["email"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_bearer(self, employee):
        r = requests.get(f"{API}/auth/me", headers=auth_h(employee["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == employee["email"]

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_bcrypt_hash_format_indirectly(self, employee):
        # Can't read hashes via API, but verify bcrypt round-trip by re-login
        r = requests.post(f"{API}/auth/login", json={"email": employee["email"], "password": employee["password"]}, timeout=15)
        assert r.status_code == 200


# ---------------- Shifts ----------------
class TestShifts:
    def test_create_list_delete_shift(self, employee):
        token = employee["token"]
        # create
        payload = {"date": "2026-01-15", "start_time": "09:00", "end_time": "17:00", "note": "TEST shift"}
        r = requests.post(f"{API}/shifts", json=payload, headers=auth_h(token), timeout=15)
        assert r.status_code == 200
        shift = r.json()
        assert shift["date"] == payload["date"]
        assert shift["user_id"] == employee["user"]["id"]
        assert "_id" not in shift
        sid = shift["id"]

        # list mine
        r = requests.get(f"{API}/shifts/mine", headers=auth_h(token), timeout=15)
        assert r.status_code == 200
        shifts = r.json()
        assert any(s["id"] == sid for s in shifts)
        for s in shifts:
            assert s["user_id"] == employee["user"]["id"]

        # delete
        r = requests.delete(f"{API}/shifts/{sid}", headers=auth_h(token), timeout=15)
        assert r.status_code == 200

        # verify gone
        r = requests.get(f"{API}/shifts/mine", headers=auth_h(token), timeout=15)
        assert all(s["id"] != sid for s in r.json())

    def test_delete_nonexistent_shift_404(self, employee):
        r = requests.delete(f"{API}/shifts/{uuid.uuid4()}", headers=auth_h(employee["token"]), timeout=15)
        assert r.status_code == 404

    def test_shifts_requires_auth(self):
        r = requests.get(f"{API}/shifts/mine", timeout=15)
        assert r.status_code == 401


# ---------------- Attendance ----------------
class TestAttendance:
    def test_checkin_status_checkout_flow(self, employee):
        token = employee["token"]
        h = auth_h(token)

        # Ensure clean state - if checked in, check out first
        s = requests.get(f"{API}/attendance/status", headers=h, timeout=15).json()
        if s.get("checked_in"):
            requests.post(f"{API}/attendance/checkout", json={}, headers=h, timeout=15)

        # status: not checked in
        r = requests.get(f"{API}/attendance/status", headers=h, timeout=15)
        assert r.status_code == 200
        assert r.json()["checked_in"] is False

        # checkin
        r = requests.post(f"{API}/attendance/checkin", json={"latitude": 10.5, "longitude": 106.7}, headers=h, timeout=15)
        assert r.status_code == 200
        rec = r.json()
        assert rec["check_in"] and rec["check_out"] is None
        assert rec["check_in_lat"] == 10.5
        assert "_id" not in rec

        # duplicate checkin -> 400
        r = requests.post(f"{API}/attendance/checkin", json={}, headers=h, timeout=15)
        assert r.status_code == 400

        # status: checked in
        r = requests.get(f"{API}/attendance/status", headers=h, timeout=15)
        assert r.json()["checked_in"] is True

        # checkout
        r = requests.post(f"{API}/attendance/checkout", json={"latitude": 10.6, "longitude": 106.8}, headers=h, timeout=15)
        assert r.status_code == 200
        out = r.json()
        assert out["check_out"] is not None
        assert out["duration_minutes"] is not None
        assert isinstance(out["duration_minutes"], int)

        # checkout again -> 400
        r = requests.post(f"{API}/attendance/checkout", json={}, headers=h, timeout=15)
        assert r.status_code == 400

    def test_attendance_mine_returns_user_records(self, employee):
        r = requests.get(f"{API}/attendance/mine", headers=auth_h(employee["token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for rec in data:
            assert rec["user_id"] == employee["user"]["id"]


# ---------------- Admin RBAC ----------------
class TestAdmin:
    def test_admin_employees(self, admin_token):
        r = requests.get(f"{API}/admin/employees", headers=auth_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for u in data:
            assert "password_hash" not in u
            assert "_id" not in u

    def test_admin_attendance(self, admin_token):
        r = requests.get(f"{API}/admin/attendance", headers=auth_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_shifts(self, admin_token):
        r = requests.get(f"{API}/admin/shifts", headers=auth_h(admin_token), timeout=15)
        assert r.status_code == 200

    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=auth_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_employees", "active_now", "total_shifts", "shifts_today"):
            assert k in d
            assert isinstance(d[k], int)

    def test_employee_forbidden_admin(self, employee):
        for ep in ("/admin/employees", "/admin/attendance", "/admin/shifts", "/admin/stats"):
            r = requests.get(f"{API}{ep}", headers=auth_h(employee["token"]), timeout=15)
            assert r.status_code == 403, f"{ep} expected 403 got {r.status_code}"

    def test_admin_unauth_401(self):
        r = requests.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 401
