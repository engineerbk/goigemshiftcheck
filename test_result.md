#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a mobile app for employees to check in and register working shifts.
  Latest enhancements: in-app notifications for swap requests; admin override
  (force approve/reject swaps + reassign shifts); employee shift cancellation
  with past-shift guard; monthly working-hours summary chart; late check-in /
  early-leave flagging.

backend:
  - task: "Notifications API (list / unread-count / mark-read / mark-all)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added /api/notifications, /api/notifications/unread-count, /api/notifications/{id}/read, /api/notifications/read-all. Notifications are emitted on swap create (target), swap accept (requester), swap reject (requester), admin force-approve/reject (both), and admin shift reassignment (old + new user)."
        -working: true
        -agent: "testing"
        -comment: "All four endpoints work end-to-end. GET /notifications returns array sorted newest first; GET /notifications/unread-count returns {count}; POST /notifications/{id}/read marks one read and decreases count by 1; POST /notifications/read-all zeroes the unread count. Notifications are correctly emitted by force-approve, force-reject, and admin shift reassignment flows (verified swap_accepted, swap_rejected, shift_assigned, shift_unassigned types reach the right users)."

  - task: "Late / early-leave flagging on attendance"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "CheckInRequest now accepts local_date/local_time. On check-in we look up the user's scheduled shift for that date and compute late_minutes; on check-out we compute early_leave_minutes vs scheduled end. Stored on attendance records."
        -working: true
        -agent: "testing"
        -comment: "Verified: with a today shift starting 08:00, check-in at 10:00 returns late_minutes=120 and shift_id populated. Checkout at 16:00 (after shift end 12:00) returns early_leave_minutes=0; checkout at 11:00 (before end 12:00) returns early_leave_minutes=60. For a user without a shift today, late_minutes is null."

  - task: "Employee cancel shift (block past dates)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "DELETE /api/shifts/{id} now rejects deletion of shifts with date < today (UTC) with 400 'Cannot cancel past shifts'."
        -working: true
        -agent: "testing"
        -comment: "DELETE on a 2020-01-01 shift returns 400 with detail 'Cannot cancel past shifts'. DELETE on a future shift returns 200 ok. Past-shift create still allowed which is fine for the guard test."

  - task: "Admin override: list, force-approve, force-reject swap requests"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/admin/swap-requests, POST /api/admin/swap-requests/{id}/force-approve, POST /api/admin/swap-requests/{id}/force-reject. Both require admin. Force-approve performs the actual shift swap. Both notify both parties."
        -working: true
        -agent: "testing"
        -comment: "GET /admin/swap-requests lists pending swaps. force-approve swaps the underlying shift owners (verified via GET /admin/shifts), sets status='accepted' and admin_approved=true, and emits swap_accepted notifications to both requester and target. force-reject keeps shift owners unchanged, sets status='rejected', and emits swap_rejected notifications to both parties."

  - task: "Monthly summary report"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/admin/reports/monthly?months=6 returns chronological per-month buckets with total_minutes, total_hours, sessions, active_users."
        -working: false
        -agent: "testing"
        -comment: "BUG: returns 404 due to FastAPI route ordering — `/admin/reports/{user_id}` was registered before `/admin/reports/monthly`."
        -working: true
        -agent: "main"
        -comment: "FIXED: moved /admin/reports/monthly handler above /admin/reports/{user_id} in server.py. Verified via curl — returns 200 with 6 chronological monthly buckets."

  - task: "Admin shift reassignment notifications"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "PATCH /api/admin/shifts/{id} now notifies the new assignee and (if changed) the old assignee."
        -working: true
        -agent: "testing"
        -comment: "PATCH /admin/shifts/{id} with {user_id: <other>} returns 200, the shift's user_id is updated, the new assignee receives a 'shift_assigned' notification and the old assignee receives 'shift_unassigned'. Verified end-to-end via the recipients' /notifications lists."

  - task: "Shift approval workflow (admin approve/reject + employee lock)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added approval_status to shifts (default 'pending'). New endpoints: GET /api/admin/shifts/pending, POST /api/admin/shifts/{id}/approve, POST /api/admin/shifts/{id}/reject (with optional reason). DELETE /api/shifts/{id} returns 400 if approval_status=='approved'. POST /api/swap-requests returns 400 if either side is approved. Notifications: shift_pending_approval (to admins on create), shift_approved (to owner), shift_rejected (to owner with reason in body)."
        -working: true
        -agent: "testing"
        -comment: "All 35 assertions pass in /app/backend_test.py against the public ingress URL. Verified end-to-end: (1) POST /shifts returns approval_status='pending' and admins receive a shift_pending_approval notification carrying data.shift_id; (2) GET /admin/shifts/pending lists the new shift, and non-admins get 403; (3) POST /admin/shifts/{id}/approve returns 200 with approval_status='approved' and the owner receives shift_approved; (4) employee DELETE on an approved shift returns 400 with detail mentioning 'Approved'; (5) POST /swap-requests returns 400 both when my_shift is approved and when target_shift is approved; (6) POST /admin/shifts/{id}/reject with {reason:'wrong store location'} returns 200 with approval_status='rejected', rejected_reason matches, and the owner gets shift_rejected with the reason embedded in the notification body; (7) after rejection the employee can DELETE the shift (200); (8) all admin endpoints reject non-admin tokens with 403 and unauthenticated calls return 401."

frontend:
  - task: "Notifications screen + global bell badge"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/notifications.tsx, /app/frontend/src/notifications.tsx, /app/frontend/src/components/NotificationBell.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added NotificationsProvider polling unread count every 30s and on app foreground. Added bell icon with badge to Home, Calendar and Admin tab headers. Tapping a notification marks it read and (for swap/shift types) routes to Calendar."

  - task: "Admin force approve/reject swap UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin-swaps.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New screen at /admin-swaps showing all pending swaps with Force Approve / Force Reject buttons; resolved history below. Linked from Admin tab via colored CTA showing pending count."

  - task: "Late / early badges in History + late banner on Home"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/history.tsx, /app/frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Home now sends local_date/local_time to backend on check-in/out and shows alert + on-card late badge. History rows show 'Late Xmin' and 'Early leave Xmin' chips when applicable."

  - task: "Monthly bar chart in Reports tab"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/reports.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Reports tab now fetches /api/admin/reports/monthly and displays a 6-month vertical bar chart with hours per month."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Shift approval workflow (admin approve/reject + employee lock)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented 5 enhancements: (1) notifications, (2) admin override for swaps, (3) employee shift cancellation with past-date guard, (4) monthly summary chart, (5) late/early flagging. Backend reloaded cleanly. Please test all backend endpoints — admin@shift.com / admin123 and any seeded employee from /app/memory/test_credentials.md. Verify: notifications fire on swap actions, admin force-approve actually swaps shifts, monthly endpoint returns 6 buckets, past shift delete returns 400, late_minutes computed when local_date/local_time provided."
    -agent: "testing"
    -message: "Backend tested via /app/backend_test.py against the public ingress URL. 37 of 38 assertions pass. ONE CRITICAL FAILURE: GET /api/admin/reports/monthly?months=6 returns 404 'Employee not found' due to a FastAPI route-ordering bug — the path-param route /api/admin/reports/{user_id} (defined at line ~427) is registered before /api/admin/reports/monthly (line ~927), so 'monthly' is captured as user_id. FIX: move the admin_reports_monthly() route definition above admin_employee_report() in server.py (or rename the path to e.g. /admin/reports-monthly). Everything else works: notifications CRUD + sorting + unread-count, late_minutes (=120) and early_leave_minutes (=0 / =60) on attendance with shift lookup, past-date delete guard (400) vs future delete (200), admin force-approve actually swaps shift owners and emits swap_accepted to both parties, force-reject leaves shifts unchanged and emits swap_rejected to both parties, PATCH /admin/shifts reassigns and emits shift_assigned + shift_unassigned. Please apply the small route-reorder fix and re-run /app/backend_test.py."
    -agent: "main"
    -message: "Round 2 — added shift approval workflow. POST /shifts now sets approval_status='pending' and notifies admins. New: GET /admin/shifts/pending, POST /admin/shifts/{id}/approve, POST /admin/shifts/{id}/reject {reason?}. Employee DELETE /shifts/{id} returns 400 if approved. POST /swap-requests rejects if either side is approved. Notifications: shift_pending_approval (to admins), shift_approved/shift_rejected (to owner). Please run focused tests on the new endpoints."