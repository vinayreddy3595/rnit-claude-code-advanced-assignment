# UI evidence — 2026-10-03T10:53:11.675Z

Captured by `npm run evidence:capture` with msedge.exe (headless) against the built client
(`vite preview`, port 5173) and the real API on a fresh synthetic DB. Each state at desktop (1280×720) and
phone width (390×760) under `screens/`. No credentials appear on screen; all records are synthetic.

| Screenshot (desktop / phone) | Action | Expected and observed |
|---|---|---|
| [01-loading](screens/desktop-01-loading.png) · [phone](screens/phone-01-loading.png) | Open the app as Manager B (North); list request held open | "Loading requests…" shown |
| [02-manager-b-list](screens/desktop-02-manager-b-list.png) · [phone](screens/phone-02-manager-b-list.png) | List loads for Manager B (North) | North requests #101 and #102, both pending |
| [03-approved](screens/desktop-03-approved.png) · [phone](screens/phone-03-approved.png) | Click "Approve 101" | Status "Request 101 approved."; #101 shows approved, buttons gone |
| [04-manager-c-south](screens/desktop-04-manager-c-south.png) · [phone](screens/phone-04-manager-c-south.png) | Switch user to Manager C (South) | Only South request #201; North #101 not listed |
| [05-employee-403](screens/desktop-05-employee-403.png) · [phone](screens/phone-05-employee-403.png) | Employee A (North) clicks "Approve 102" | Server says 403: "Only managers can approve or reject leave." |
| [06-api-down](screens/desktop-06-api-down.png) | API stopped, open the app | Error shown in an alert region; no stale rows |

## What these screenshots prove, and what they cannot

| Can show | Cannot prove |
|---|---|
| Loading, approved, 403 and error states; layout at two widths | Authorization: that is proved by API tests C1–C14 and 07-api-transcript.md |
| South user's screen does not list North's #101 | That the API refuses it: proved by C3/C3b/C13 and the mutation check |
| Status announcements exist (`role="status"`, `role="alert"`) | Screen-reader behaviour; not tested with a real screen reader |