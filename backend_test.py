"""Backend integration tests for the shift approval workflow."""

import os
import sys
import uuid
import requests
from datetime import datetime, timezone, timedelta

BASE = os.environ.get(
    "BACKEND_URL",
    "https://shift-checkin.preview.emergentagent.com",
).rstrip("/") + "/api"

ADMIN_EMAIL = "admin@shift.com"
ADMIN_PASSWORD = "admin123"

PASS = []
FAIL = []


def log(ok, name, detail=""):
    if ok:
        PASS.append(name)
        print(f"PASS  {name}")
    else:
        FAIL.append((name, detail))
        print(f"FAIL  {name}: {detail}")


def post(path, token=None, json_body=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.post(BASE + path, headers=headers, json=json_body, timeout=20)


def get(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(BASE + path, headers=headers, timeout=20)


def delete(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.delete(BASE + path, headers=headers, timeout=20)


def login(email, password):
    r = post("/auth/login", json_body={"email": email, "password": password})
    if r.status_code != 200:
        return None
    return r.json()["token"]


def register_or_login(email, password, name):
    r = post("/auth/register", json_body={"email": email, "password": password, "name": name})
    if r.status_code == 200:
        return r.json()["token"]
    return login(email, password)


def future_date(offset_days=7):
    return (datetime.now(timezone.utc) + timedelta(days=offset_days)).date().isoformat()


def main():
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    log(admin_token is not None, "admin login")
    if not admin_token:
        return 1

    suffix = uuid.uuid4().hex[:6]
    emp_a_email = f"alice.{suffix}@shift.com"
    emp_b_email = f"bob.{suffix}@shift.com"
    a_token = register_or_login(emp_a_email, "alicepass1", "Alice Tester")
    b_token = register_or_login(emp_b_email, "bobpass1", "Bob Tester")
    log(a_token is not None, "employee A login")
    log(b_token is not None, "employee B login")

    # ---- TEST 1 ----
    r = post("/shifts", a_token, {
        "date": future_date(7), "start_time": "09:00", "end_time": "17:00",
        "note": "test approval flow", "store_location": "Hanoi", "shift_type": "regular",
    })
    log(r.status_code == 200, "POST /shifts (employee A)", f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return 1
    shift_a = r.json()
    sid = shift_a.get("id")
    log(shift_a.get("approval_status") == "pending",
        "Created shift has approval_status='pending'", f"got {shift_a.get('approval_status')}")

    r = get("/notifications", admin_token)
    log(r.status_code == 200, "GET /notifications (admin)", f"{r.status_code}")
    notes = r.json() if r.status_code == 200 else []
    matched = [n for n in notes if n.get("type") == "shift_pending_approval"
               and n.get("data", {}).get("shift_id") == sid]
    log(len(matched) >= 1, "admin received shift_pending_approval for new shift",
        f"matches={len(matched)} total_notifs={len(notes)}")

    # ---- TEST 2 ----
    r = get("/admin/shifts/pending", admin_token)
    log(r.status_code == 200, "GET /admin/shifts/pending (admin)", f"{r.status_code} {r.text[:200]}")
    pending_ids = [s.get("id") for s in (r.json() if r.status_code == 200 else [])]
    log(sid in pending_ids, "pending list contains the new shift",
        f"first 5 ids={pending_ids[:5]}")
    r = get("/admin/shifts/pending", a_token)
    log(r.status_code == 403, "non-admin GET /admin/shifts/pending → 403", f"{r.status_code}")

    # ---- TEST 3 ----
    r = post(f"/admin/shifts/{sid}/approve", admin_token)
    log(r.status_code == 200, "admin approve shift", f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        log(body.get("approval_status") == "approved",
            "approve response has approval_status='approved'", f"got {body.get('approval_status')}")
    r = get("/notifications", a_token)
    notes_a = r.json() if r.status_code == 200 else []
    matched = [n for n in notes_a if n.get("type") == "shift_approved"
               and n.get("data", {}).get("shift_id") == sid]
    log(len(matched) >= 1, "employee A received shift_approved notification",
        f"matches={len(matched)}")
    r = post(f"/admin/shifts/{sid}/approve", a_token)
    log(r.status_code == 403, "non-admin approve → 403", f"{r.status_code}")

    # ---- TEST 4 ----
    r = delete(f"/shifts/{sid}", a_token)
    log(r.status_code == 400, "DELETE approved shift → 400", f"{r.status_code} {r.text[:200]}")
    if r.status_code == 400:
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        log("Approved" in detail or "approved" in detail.lower(),
            "delete-approved error mentions 'Approved'", f"detail={detail}")

    # ---- TEST 5 ----
    s1_resp = post("/shifts", a_token, {
        "date": future_date(8), "start_time": "08:00", "end_time": "12:00",
        "note": "S1", "store_location": "X", "shift_type": "regular",
    })
    log(s1_resp.status_code == 200, "A creates S1", f"{s1_resp.status_code} {s1_resp.text[:120]}")
    s1 = s1_resp.json()
    s2_resp = post("/shifts", b_token, {
        "date": future_date(9), "start_time": "13:00", "end_time": "17:00",
        "note": "S2", "store_location": "Y", "shift_type": "regular",
    })
    log(s2_resp.status_code == 200, "B creates S2", f"{s2_resp.status_code} {s2_resp.text[:120]}")
    s2 = s2_resp.json()

    r = post(f"/admin/shifts/{s1['id']}/approve", admin_token)
    log(r.status_code == 200, "admin approves S1 (S2 still pending)", f"{r.status_code}")
    r = post("/swap-requests", a_token, {
        "my_shift_id": s1["id"], "target_shift_id": s2["id"], "message": "swap?"
    })
    log(r.status_code == 400, "swap with approved my_shift → 400",
        f"{r.status_code} {r.text[:200]}")

    s1b_resp = post("/shifts", a_token, {
        "date": future_date(10), "start_time": "08:00", "end_time": "12:00",
        "note": "S1b", "store_location": "X", "shift_type": "regular",
    })
    log(s1b_resp.status_code == 200, "A creates S1b (pending)", f"{s1b_resp.status_code}")
    s1b = s1b_resp.json()
    r = post(f"/admin/shifts/{s2['id']}/approve", admin_token)
    log(r.status_code == 200, "admin approves S2", f"{r.status_code}")
    r = post("/swap-requests", a_token, {
        "my_shift_id": s1b["id"], "target_shift_id": s2["id"], "message": "swap?"
    })
    log(r.status_code == 400, "swap with approved target_shift → 400",
        f"{r.status_code} {r.text[:200]}")

    # ---- TEST 6 ----
    s3_resp = post("/shifts", a_token, {
        "date": future_date(11), "start_time": "10:00", "end_time": "18:00",
        "note": "S3", "store_location": "Z", "shift_type": "regular",
    })
    log(s3_resp.status_code == 200, "A creates S3 (pending)", f"{s3_resp.status_code}")
    s3 = s3_resp.json()
    reason = "wrong store location"
    r = post(f"/admin/shifts/{s3['id']}/reject", admin_token, {"reason": reason})
    log(r.status_code == 200, "admin rejects S3", f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        log(body.get("approval_status") == "rejected",
            "reject response has approval_status='rejected'",
            f"got {body.get('approval_status')}")
        log(body.get("rejected_reason") == reason,
            "reject response has rejected_reason matching",
            f"got {body.get('rejected_reason')!r}")

    r = get("/notifications", a_token)
    notes_a = r.json() if r.status_code == 200 else []
    matched = [n for n in notes_a if n.get("type") == "shift_rejected"
               and n.get("data", {}).get("shift_id") == s3["id"]]
    log(len(matched) >= 1, "A received shift_rejected notification", f"matches={len(matched)}")
    if matched:
        nbody = matched[0].get("body", "")
        log(reason in nbody, "rejection notification body contains reason",
            f"body={nbody!r}")

    r = post(f"/admin/shifts/{s3['id']}/reject", a_token, {"reason": "x"})
    log(r.status_code == 403, "non-admin reject → 403", f"{r.status_code}")

    # ---- TEST 7 ----
    r = delete(f"/shifts/{s3['id']}", a_token)
    log(r.status_code == 200, "A can DELETE rejected S3 → 200",
        f"{r.status_code} {r.text[:200]}")

    # ---- TEST 8 ----
    for method, p in [
        ("GET", "/admin/shifts/pending"),
        ("POST", f"/admin/shifts/{s1['id']}/approve"),
        ("POST", f"/admin/shifts/{s1['id']}/reject"),
    ]:
        if method == "GET":
            r = get(p, b_token)
        else:
            r = post(p, b_token, {"reason": "x"})
        log(r.status_code == 403, f"non-admin {method} {p} → 403",
            f"{r.status_code} {r.text[:120]}")

    r = requests.get(BASE + "/admin/shifts/pending", timeout=20)
    log(r.status_code in (401, 403), "unauthenticated GET /admin/shifts/pending → 401/403",
        f"{r.status_code}")

    print("\n=== RESULTS ===")
    print(f"PASS: {len(PASS)}")
    print(f"FAIL: {len(FAIL)}")
    for n, d in FAIL:
        print(f" - {n}: {d}")
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(main())
