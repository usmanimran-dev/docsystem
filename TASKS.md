# Tasks

_Last updated: 17 Aug 2026_

---

## Done

| # | Task | Note |
|---|---|---|
| 1 | **Department module** — Create + Inquiries | Maintenance screen with Save → Submit → Approve, tabs backed by their own endpoints |
| 2 | **Login via backend** | Real `POST /login`, JWT stored, `usercat` mapped to ADMIN/USER |
| 3 | **JWT interceptor** | Attaches `Authorization: Bearer` to every request except login; clears session on 401/403 |
| 4 | **Auth guard** | No screen opens without login; role checked per route |
| 5 | **Department dropdown on Create User** | Populated from `/departmentlist` (approved departments only) |
| 6 | **Search By Ref ID** — Event Reference made optional | Master-only search uses `listdocumentsbytnxreference` |
| 7 | **Pending / Submitted / Approved Documents** | Three pages, one shared component, search by tnxreference |
| 8 | **Create User dropdown values fixed** | Was sending `ACTIVE`/`ADMIN`; now sends `A`/`U` as the backend stores |
| 9 | **Form spacing reduced** | Material reserves a hint line under every field — switched to `subscriptSizing: dynamic` app-wide and tightened margins |
| 10 | **User module screens** | Create User is now a maintenance screen; User Inquiries with Pending/Submitted/Approved tabs |
| 11 | **Type column fixed** | Imad confirmed `doctype` is unused and `docdoccat` is the document type — dropped the empty column and renamed the filled one |
| 12 | **Statement parser** | Java + Tika at `D:\edms\parsingwork`. Watches `incoming/`, extracts 4 fields, uploads via `dms/save`, routes to `success/` or `failed/`. Own git repo, own README. |
| 13 | **Demo data + cleanup** | Every Inquiries tab now has records; removed 7 leftover test records and one broken user row |

---

## Our tasks

| # | Task | Why |
|---|---|---|
| 1 | Wire **Create Product** to `addproduct` | Console.log only |
| 2 | Wire **Signup** screen | Also creates users, not connected |
| 3 | Remove `changepassword` from Create User | Not in the backend DTO — it goes nowhere |
| 4 | Add real bank formats to the parser | Only `DemoBankFormat` is registered; needs real sample statements from Imad |
| 5 | Push the parser to a remote | Committed locally only — no backup |

---

## Waiting on Imad

| # | Blocked on | Note |
|---|---|---|
| 1 | Real bank statement samples | Parser can't recognise any real layout without them |
| 2 | `dms/save` accepts a duplicate docid | Writes a second record, then `searchdocument` returns 500 for that id and the document can't be opened. Parser guards against it, but the backend should too. |
| 4 | Maker-checker not enforced on users | `saveuser`/`submituser`/`approveuser` all with `appuser=jwttest` → all 200. DB shows `inputterid` and `authorizerid` both `jwttest`. |
| 5 | `rejectdepartment` / `rejectuser` not exposed | No way to send a record back — that's why there's no Reject button |
| 6 | JWT `sub` holds `username`, not `loginid` | Any user whose display name differs from their login id gets 500 on every request. Live proof: `jwttest` works, `testadmin` (username "Test Admin") 500s. |
| 7 | Default admin user not created | Added the `default.user.*` properties but this JAR doesn't read them — a newer JAR was sent after the properties |
| 8 | Invalid token returns 500, not 401 | Interceptor can't catch 500, so no auto-redirect to login |
| 9 | `/login` also runs the JWT filter | Stale token → 500 on login itself; user gets stuck |
| 10 | Token expires in 24 min, config says 60 | Said "will check later" |
| 11 | `filesize` / `productcode` not in response DTO | Both exist in MongoDB, would be useful in the documents table |
| 12 | `smallfilecontent` size limit | Whole PDF stored base64 inside the document; MongoDB caps at 16MB but config allows 20MB uploads (~27MB after base64) |

---

## My suggestions

| # | Suggestion | Why |
|---|---|---|
| 1 | Turn Pending/Submitted/Approved Documents into **tabs on one screen** | Documents menu now has 5 items; Inquiries screens already use tabs |
| 2 | Add a **confirmation dialog** before Approve | Approving is irreversible from the UI and there's no undo |
| 3 | Move the backend hostname out of `environment.ts` | Internal hostnames in committed files travel with the repo |
| 4 | Fix the **failing unit tests** (12 of 19) | All fail with `No provider for HttpClient` in the CLI stubs |

---

## Test accounts

| Login | Password | Role | Note |
|---|---|---|---|
| `jwttest` | `Test@1234` | ADMIN | Use this one |
| `normaluser` | `Test@1234` | USER | For the user panel |
| `system2` | `pass123` | USER | Imad's account |
| `testadmin` | `Test@1234` | ADMIN | **Don't log in** — demonstrates the JWT `sub` bug (500 on every request) |

Demo records with realistic names (`ali.khan`, `sara.ahmed`, `bilal.raza`) exist for the Inquiries screens. They cannot log in for the same reason as `testadmin`.
