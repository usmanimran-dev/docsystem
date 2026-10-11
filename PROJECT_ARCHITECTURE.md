# DocuFinder / DMS — Project Architecture and Handover

**Read this first in any new chat.** It is the full picture of the project: what exists, how it fits together, what was learned the hard way, what is broken, and how the user likes to work.

**Last updated:** 2026-09-20 (rewritten after the demo-prep sessions of 2026-09-18 to 2026-09-20)

> **No secrets in this file on purpose.** API keys live in `run-service.ps1` (examination service folder) and environment variables. `AGENTS.md` forbids writing secrets into docs. Do not paste keys here.

---

## Table of Contents

1. [What this project is](#1-what-this-project-is)
2. [Working agreements with the user](#2-working-agreements-with-the-user)
3. [Current status snapshot](#3-current-status-snapshot)
4. [Architecture at a glance](#4-architecture-at-a-glance)
5. [The two databases](#5-the-two-databases)
6. [The three services](#6-the-three-services)
7. [App pages: admin portal and user portal](#7-app-pages-admin-portal-and-user-portal)
8. [Document Reader: features and flow](#8-document-reader-features-and-flow)
9. [Filing into the DMS: product codes and references](#9-filing-into-the-dms-product-codes-and-references)
10. [Compliance: how sanction and high-risk detection works](#10-compliance-how-sanction-and-high-risk-detection-works)
11. [Authentication, the JWT filter bug and the workaround](#11-authentication-the-jwt-filter-bug-and-the-workaround)
12. [Paths, keys, start and stop](#12-paths-keys-start-and-stop)
13. [Moving the project to the demo laptop](#13-moving-the-project-to-the-demo-laptop)
14. [Testing notes and traps](#14-testing-notes-and-traps)
15. [Known issues and to-do lists](#15-known-issues-and-to-do-lists)
16. [Field extraction reference](#16-field-extraction-reference)
17. [Common errors and what they mean](#17-common-errors-and-what-they-mean)
18. [Uncommitted work inventory](#18-uncommitted-work-inventory)
19. [Business and legal notes](#19-business-and-legal-notes)
20. [Session history](#20-session-history)

---

## 1. What this project is

A trade-finance **Document Management System (DMS)** with a built-in **Document Reader** (upload, OCR, field extraction, compliance screening) and a **user portal** for searching filed documents. It was built for a **bank demo**.

- **Frontend:** Angular 19 (standalone components, lazy routes), repo root `C:\Users\Usman\Downloads\PDF_Searcher`.
- **DMS backend:** `dmsclientext-0.0.1.jar` (Spring Boot, MongoDB `edms`), owned by **Imad**. **No source code on this machine**, only the compiled JAR.
- **Examination service:** `edms-examination-service` (Spring Boot 3.3.4, MongoDB `edms_examine`). Source is on this machine and is ours.
- The user is **Usman** (developer). Imad is the senior developer who owns the DMS JAR and makes some design decisions.

## 2. Working agreements with the user

- The user writes in **Roman Urdu mixed with English**. Reply in clear English; use Roman Urdu when drafting messages meant for Imad or when the user writes that way.
- **Keep answers short.** The user asks for "short msg" often. Lead with the result.
- **Do not build things that were not asked for.** In a past session the user said "I was talking about the pages in the PDF_Searcher folder" after Claude built a replacement page. When the user refers to existing pages or behaviour, **analyse the existing code first** and report; ask before adding new pages or features.
- **Do not commit or push unless asked.** Earlier the user said "don't commit it"; on 2026-09-20 they asked for the repo to be prepared, so those commits were made. Pushing needs their GitHub login, so they run `git push` themselves.
- **Verify before claiming.** Several early diagnoses were wrong (see section 11: the "CSRF" theory was a false diagnosis). Test with the real browser flow, not only curl.
- The user is presenting a **demo** and needs a stable system. Prefer small, reversible, flagged changes near demo time.
- Do not put secrets in files, logs or chat. Do not run paid-API calls (DataDocked, OpenSanctions) for casual testing.

## 3. Current status snapshot

| Area | State |
|---|---|
| Document Reader (LC, BOL, other types) | Working end to end |
| Sanction / high-risk detection (countries, ports, HS codes, vessels) | Working; port and country matching for LCs fixed on 2026-09-20 |
| Filing to the DMS | Working for ILC, INV, ACC, CUS, MAA, SRT. BL, PO, RCP fall back to SRT |
| User portal search and status lists | Working (tested as admin and as `normaluser`) |
| Compliance Data page (CSV upload) | Working; note the source CSV problem in section 15 |
| DMS JAR auth | **Permit-all** (Imad's demo build). Frontend does **not** send the token (temporary flag) |
| Vessel checks | Depend on DataDocked credits, which ran out twice; a new key was installed on 2026-09-20 |
| Demo deck | Web deck published as a claude.ai artifact (link in section 20). User chose PDF download, no .pptx |
| Git | New private GitHub repo `usmanimran-dev/docfinder` (remote `origin`). Work was committed locally on 2026-09-20; the user pushes (section 13a) |

## 4. Architecture at a glance

```
┌───────────────────────────────────────────────────────────┐
│                  Angular frontend :4200                   │
│  PDF.js + Tesseract.js in the browser, field extraction,  │
│  validation rules, compliance orchestration               │
└───────┬─────────────────────────────────────┬─────────────┘
        │ /examine/*  (proxy)                 │ /api/*  (proxy)
        ▼                                     ▼
┌─────────────────────────┐        ┌─────────────────────────┐
│ edms-examination-service│        │ dmsclientext.jar  :8082 │
│ :8090                   │        │ DMS backend, JWT login  │
│ compliance lists, vessel│        │ file storage, masters,  │
│ checks, analysis history│        │ maker-checker workflow  │
└──────────┬──────────────┘        └───────────┬─────────────┘
           ▼                                   ▼
   MongoDB `edms_examine`                MongoDB `edms`
   External: OpenSanctions (entity screening), DataDocked (vessels)
```

**Critical rule:** the two databases never talk to each other. **The Angular app is the only bridge.** A scan writes to `edms_examine`. Clicking Proceed makes Angular call the DMS, which writes to `edms`.

The dev proxy (`proxy.conf.json`) makes everything same-origin: `/api` goes to 8082 and `/examine` goes to 8090, with the prefix stripped. The backends send no CORS headers, so the browser must always go through the proxy.

## 5. The two databases

Both live on one MongoDB server, `localhost:27017`.

### `edms` (DMS, owned by the JAR)
- `documentmaster<code>` collections, one per product code. Each document stores `tnxreference`, `productcode`, `description`, `docdoccat`, `documentstatus`, and the **file bytes inline** (`smallfilecontent`, BinData).
- `documentrecordbyproduct`, `documenttypemaster`, `departmentmaster`, `usermaster`.
- Many `documentmaster*` collections exist (ILC, CUS, MAA, SRT, INV, ACC and others). **A collection existing does not mean the backend accepts that code** (see section 9).

### `edms_examine` (reader and compliance, owned by the examination service)
- `document_analyses`: one row per scan (fields, OCR text, anomaly report, duplicate info).
- `fs.files` / `fs.chunks`: GridFS, the scanned files themselves.
- `sanctioned_countries`, `sanctioned_ports`, `sanctioned_hscode_countries`, `hs_code_pricing`: compliance data.

## 6. The three services

| Service | Port | Location | Notes |
|---|---|---|---|
| Angular dev server | 4200 | `C:\Users\Usman\Downloads\PDF_Searcher` | `npm start` (`ng serve`) |
| DMS backend | 8082 | `D:\edms\properties\dmsclientext-0.0.1.jar` | Java 17. Config path is **hard-coded** to `file:d:/edms/properties/clientapplication.properties` |
| Examination service | 8090 | `C:\Users\Usman\Downloads\edms-examination-service\target\examination-service.jar` | Needs two API key env vars at process start |
| MongoDB | 27017 | Windows service | Data dir `D:\Program Files\MongoDB\Server\8.0\data` |

### Examination service endpoints (used by the frontend via `/examine`)
- `GET /compliance/check-country?value=`, `/countries`, `POST /countries/import`
- `GET /compliance/check-port?value=` (**UN/LOCODE only**), `/ports`, `POST /ports/import`
- `GET /compliance/check-hscode-price`, `/check-hscode-sanction`, `/hscode-pricing`, `/hscode-sanctions`, `/check-entity`
- `GET /vessel/check-flag?imo=`, `/check-ownership`, `/check-route`, `/port-calls`, `/location`, `/particulars`, `/management`
- `POST /documents` (create analysis), `POST /documents/{id}/file`, `GET /documents/{id}`, `GET /documents/{id}/file`, `GET /documents/by-hash/{hash}`

### DMS endpoints seen in use
`POST /login`, `POST /dms/save` (multipart), `GET /pendingusers|approvedusers|submittedusers`, `.../pendingdepartment|...`, `.../pendingdocumenttype|approveddocumenttype|submittedddocumenttype` (three d's, matches the backend), `GET /pendingdocuments|submitteddocuments|approveddocuments`, `GET /mydms/searchdocument/{docid}` (the file), `GET /mydms/listdocumentsbytnxreference?tnxreference=`, `GET /mydms/listdocumentsbyref?tnxreference=&eventreference=`, `POST /addproduct`.

## 7. App pages: admin portal and user portal

Routes are in `src/app/app.routes.ts`, the sidebar in `src/app/core/page-layout/page-layout.component.ts`. Role comes from login: `usercat` `A` becomes ADMIN, `U` becomes USER.

### Admin portal (`/adminPanel/...`)
| Sidebar | Page | What it does |
|---|---|---|
| Dashboard | `admin-dashboard` | **Blank page** in this build |
| Product > Create Product | `create-product` | One field: product code (`POST /addproduct`) |
| Users > Create User / Inquiries | `create-user`, `user-inquiries` | Login ID, password, name, status, category, department (approved ones only), contact, email, employee ID, address |
| Department > Create / Inquiries | `create-department`, `department-inquiries` | Code, name, status |
| Document Type > Create / Inquiries | `create-document-type`, `document-type-inquiries` | Type ID, name, status |
| Document Scanner | `document-scanner` (titled **Document Reader**) | Section 8 |
| Compliance Data | `compliance-data` | Countries and Ports tabs, CSV upload |

- **Maker-checker:** every create page follows Save, then Submit, then Approve or Reject (status chip saved / submitted / approved; Update before submit). Inquiries pages have Pending / Submitted / Approved tabs, a search box and an Open action.
- `adminPanel/InquiryRecords` exists as a route but is a **hard-coded stub** with 2 fake users and no sidebar link. It is not a real DMS page. Leave it alone unless asked.

### User portal (`/userPanel/...`)
Sidebar: Dashboard, Documents > Search By Doc ID, Search By Ref ID, Pending, Submitted, Approved Documents.
- **Search By Ref ID** (`search-ref`): master reference plus optional event reference, for example `SRT-ILC-...`. Click the file name to open the original.
- **Search By Doc ID** (`search-doc`): the document ID shown after a save. Opens the file directly.
- **Pending / Submitted / Approved** (`document-status`, one component, `data.stage`): full list for that stage with a filter (reference, file name or document ID). **Documents filed by the scanner appear under Pending Documents** (the backend buckets them there even though their `documentstatus` is `A`).
- **User Dashboard search box** (`user-dashboard`): fixed on 2026-09-20. It now uses the same call as Search By Ref ID (`ApiService.getDocumentsByTnxReference`), lists the matching documents (file name, reference, description) and opens the original with `ApiService.searchDocument`. A 400 "No Data found" from the backend is shown as "No documents found", and a failed search no longer kills the search stream. It used to call `PdfService`, which pointed at `https://example.com/api/pdfs` and fell back to fake `REF-1001` data. `core/services/pdf.service.ts` is now unused.
- `/userPanel` (dashboard) is role-guarded to USER: an admin gets redirected. The other `/userPanel/...` routes have no guard, so an admin can open them by typing the URL (the admin sidebar has no link).

### Test accounts (from `TASKS.md`)
Admin: `admin` / `admin123`. User portal: `normaluser` / `Test@1234`. `system2` / `pass123` is Imad's USER account. `ali.khan`, `sara.ahmed`, `bilal.raza`, `testadmin` cannot log in (JWT `sub` bug, see `TASKS.md`).

## 8. Document Reader: features and flow

Page: `src/app/pages/ADMIN/document-scanner/`. It analyses a file **in the browser**, then saves the analysis to the examination service.

**Flow on upload** (`onFileSelected` then `loadPdf`/`loadImage` then `runFullAnalysis`):
1. PDF: PDF.js reads embedded text; if there is none, the rendered page is OCR'd with Tesseract.js. Images go straight to OCR. Tesseract assets are self-hosted in `public/tesseract/` (works offline).
2. Duplicate check: exact file hash, and same-content key for a re-scanned copy.
3. `field-extraction.service.ts` detects the document type and extracts fields (each with a confidence).
4. `anomaly-detection.service.ts` runs rule-based validation (section 16).
5. Compliance checks call the examination service (section 10).
6. The analysis and the file are saved to `edms_examine`; the id is stored in `localStorage` key `documentReader.lastAnalysisId` and **reloading the page restores the last analysis**.

**Page cards:** Saved, Duplicate Check, Document Type (with match confidence), Extracted Fields (confidence per field), Recognised Text (OCR confidence), Validation (critical / warning / info counts, each issue with reason and suggestion).
**Actions:** Proceed and send the document to DMS (renamed from "Proceed and Save" on 2026-09-20 at Imad's request; product code shown first; success/failure cards now say "Sent to DMS" / "Send Failed"), Download Report (JSON file), Open in New Tab, Clear.
**Disabled or archived:** the Watchlist Screening card (`showEntityScreening = false`, metered OpenSanctions) and manual region selection (`selectionMode = false`).

**Restore behaviour (fixed 2026-09-20):** `applyRestoredAnalysis` re-runs only the rule-based checks (issue ids starting `doc_`, `data_`, `fin_`, `sanction_limit_`) and **keeps the stored backend-derived issues** (country, port, HS code, pricing, entity, vessel). Earlier, restore dropped all compliance flags.

## 9. Filing into the DMS: product codes and references

`proceedAndSaveToDms()` posts multipart to `/api/dms/save` with `file`, `appuserid`, `tnxreference`, `tnxreferenceaction=SAVE`, `description`, `documentstatus=A`, `documentcat`, `docdoccat=Scan Report`, `productcode`.

**Live probe results (2026-09-19):** the backend accepts `ILC`, `INV`, `ACC`, `CUS`, `MAA`, `SRT` (HTTP 200). It rejects `BL`, `PO`, `RCP` with **HTTP 500 "Failed to upload file"** because those collections/classes do not exist yet. **`dms.products` in `clientapplication.properties` is not the gate** (INV and ACC work without being listed).

| Detected type | Doc code | Filed under (product code) |
|---|---|---|
| IMPORT_LETTER_OF_CREDIT, LETTER_OF_CREDIT | ILC | ILC |
| INVOICE | INV | INV |
| BANK_STATEMENT | ACC | ACC |
| BILL_OF_LADING | BL | **SRT** (fallback) |
| PURCHASE_ORDER | PO | **SRT** (fallback) |
| RECEIPT | RCP | **SRT** (fallback) |
| unrecognised | SRT | SRT |

Implementation: `SUPPORTED_PRODUCTS`, `docCodeFor()`, `resolveProductCode()` in `document-scanner.component.ts`. When Imad ships BL/PO/RCP, add the code to `SUPPORTED_PRODUCTS`.

**Two records per send (added 2026-09-20):** `proceedAndSaveToDms()` files the original document under its product code, then calls `fileAnalysisReport()` to file a second record under **SRT** with the **same `tnxreference`**, `docdoccat: 'Analysis Report'`. The report is a readable `.txt` (`<name>-analysis-report.txt`) built by `buildAnalysisReportText()`: header (document, reference, type and match, product code, timestamp, user, analysis id, OCR confidence), every extracted field with its confidence, the duplicate-check outcome, and the validation status with each issue's severity, message and suggested action. **It must not be JSON** — `dms.upload.allowedextensions` is `pdf,txt,jpg,png,doc,docx,xls,xlsx`. The report save is wrapped in its own try/catch, so if it fails the document send is still reported as successful and the error card says only the report failed. Verified 2026-09-20: one reference returned both records from `/mydms/listdocumentsbytnxreference`, and the test rows were deleted afterwards.

**Reference format** (requested by Imad, 2026-09-19): `SRT-<docCode>-<timestamp>`, for example `SRT-ILC-1789816200659` or `SRT-BL-1789816576640`. The `SRT` prefix marks scanner saves; the middle part is the real document type even when filed under SRT.

## 10. Compliance: how sanction and high-risk detection works

**Data:** bank lists in `edms_examine`. Countries have tiers (`BANK_SANCTIONED` critical, `BANK_HIGH_RISK` warning, plus OFAC/FATF baseline seeded automatically on an empty table). Ports have tiers `SANCTIONED` (critical) and `HIGH_RISK` (warning). The user loads both lists through Compliance Data CSV upload (merge by key, nothing deleted, skipped rows explained with line and reason).

**CSV formats**
- Countries: `iso_code,country_name,category,aliases` (aliases optional, semicolon separated). `category` must be `SANCTIONED` or `HIGH_RISK`.
- Ports: `unlocode,port_name,category` (5-character UN/LOCODE).

**Backend rules (do not change lightly):** `check-port` matches **UN/LOCODE only**. Imad decided on 2026-09-14 that port risk must come from real per-port entries and must not be inferred from the port's country. `check-country` resolves names and aliases.

**Frontend gap fix (2026-09-20):** LCs print port **names** and have no `Country:` line, so nothing was flagged. In `document-scanner.component.ts`:
- `loadComplianceLists()` fetches `/compliance/ports` and `/compliance/countries` at the start of each scan (fail-soft).
- `resolvePortCode(text)`: exact LOCODE match, else the longest listed port name found as whole words in the text, else the raw text (so BOLs that print codes behave as before).
- `checkCountriesFromPorts()`: when there is no `country` field, finds a listed country (name or alias, whole words) in the loading/discharge port text and runs the normal country check, with the message prefixed "Port of loading country:" / "Port of discharge country:".
- Result on the demo LC: Pakistan critical, United Arab Emirates warning, Jebel Ali (AEJEA) warning, overall FAILED.

**Other checks:** HS-code price range (always a warning), HS-code plus country export control, vessel flag state (country tiers), vessel ownership (OpenSanctions), route deviation (warning). Vessel checks need an IMO number and internet, and cost DataDocked credits.

**Demo data warning:** `demo-data/bank-countries.csv` marks **Pakistan as SANCTIONED only so the demo has something to flag**. It is not on any real list. The deck says so on the compliance slides. Real sales need real sources (section 19).

## 11. Authentication, the JWT filter bug and the workaround

- Login: `POST /api/login` returns `{jwtToken, usercat}`; token in `localStorage.auth_token`, mapped role in `localStorage.usercat`. The JWT expires after 1 hour.
- `auth.interceptor.ts`: logs out **only on 401** (403 is shown in the UI). Login requests are skipped.

**The 2026-09-19 diagnosis history (do not repeat the mistake):** a 403 seen with `curl` and no token was blamed on CSRF and CORS. That was **wrong**: curl had no Authorization header and the old JAR required one. The browser flow was fine.

**Imad's new permit-all JAR (2026-09-19) has a real bug.** In `JwtAuthenticationFilter.doFilterInternal`, right after the token is extracted from the `Bearer` header, there is a `chain.doFilter(request, response)` with **no `return`**. Execution falls through and calls `doFilter` again at the end, so **every request with an Authorization header runs twice and GET bodies come back doubled** (for example 903 bytes without a token, 1806 with one, even for `Bearer garbage`). Two JSON arrays back to back fail Angular's parser with **"Http failure during parsing"**, which broke every list page.

**Workaround in place (temporary):** `environment.attachAuthToken = false` in `src/environments/environment.ts`, and the interceptor only attaches the Bearer token when it is `true`. The JAR ignores auth right now, so nothing else changes. `environment.prod.ts` has `true` (that file is not used by any build).
**When Imad ships a fixed JAR:** set `attachAuthToken: true` and re-test list pages. A message about the bug was drafted for Imad.

Whether a POST with a Bearer token runs twice was never confirmed (Mongo counts showed one row per save).

## 12. Paths, keys, start and stop

### Paths
- Frontend: `C:\Users\Usman\Downloads\PDF_Searcher` (`src/app/core/services/`, `src/app/pages/ADMIN/`, `src/app/pages/USER/`, `src/environments/`, `proxy.conf.json`, `.claude/launch.json`)
- DMS: `D:\edms\properties\` (`dmsclientext-0.0.1.jar` plus `clientapplication.properties`, `coreapplication.properties`; many `.bak/.backup/.previous` copies)
- Examination service: `C:\Users\Usman\Downloads\edms-examination-service\` (`target\examination-service.jar`, `run-service.ps1`, `demo-data\`, `DEPLOYMENT.md`, `FEATURES.md`, `README.md`)
- `mongosh` is on PATH; `mongodump` is not installed.

### Keys (names only)
- `DATADOCKED_API_KEY`: vessel tracking. **1 credit per call; a BOL scan makes several calls.** It ran out on 2026-09-18 and again on 2026-09-20 ("Not enough credits or endpoint in black list"); a new key was installed on 2026-09-20.
- `OPENSANCTIONS_API_KEY`: entity/ownership screening. Trial tier is about 50 requests a month.
- Both are read **when the service process starts**. Setting a variable in a terminal does not affect a running process: stop the service and start it again.
- `run-service.ps1` holds both keys in plain text and also runs `mvn clean package` first. Do not commit or share it. On a machine without Maven start with `java -jar target\examination-service.jar` after setting the two variables.

### Start order
MongoDB, then the DMS JAR, then the examination service, then `npm start`. Give each backend about 20 seconds.

```powershell
cd D:\edms\properties
java -jar dmsclientext-0.0.1.jar --spring.config.location=file:./clientapplication.properties

$env:DATADOCKED_API_KEY = "<key>"; $env:OPENSANCTIONS_API_KEY = "<key>"
cd C:\Users\Usman\Downloads\edms-examination-service
java -jar target\examination-service.jar

cd C:\Users\Usman\Downloads\PDF_Searcher
npm start
```

In Claude Code sessions the DMS and Angular can be started with `preview_start` using the names in `.claude/launch.json` ("Backend (Java)", "Frontend (Angular)"). **Servers started that way stopped between sessions** (twice on 2026-09-20). Check the ports at the start of every session.

### Health check
```bash
for p in 4200 8082 8090 27017; do curl -s -m 5 -o /dev/null -w "$p -> %{http_code}\n" http://localhost:$p; done
```
Expect 200, 400, 404, 200 (400 and 404 are normal root responses). Also `POST /login` with admin should return 200, and `GET /api/pendingusers` through 4200 should be 903 bytes (a single copy).

## 13a. The docfinder repository (created 2026-09-20)

One repo now holds everything except a few manual items. Repo root is this folder (`PDF_Searcher`), remote `https://github.com/usmanimran-dev/docfinder.git`, branch `main`. **It must stay private**: `examination-service/demo-data/db-export` holds user accounts with password hashes.

| In git | Where |
|---|---|
| Angular frontend | repo root (`src`, `public` with the OCR files, `package.json`, ...) |
| Examination service **source** | `examination-service/` (its old separate repo was not deleted, it only lived on this PC; this copy has no `.git`, `target/`, logs or `run-service.ps1`) |
| Database export | `examination-service/demo-data/db-export/` (re-run `mongosh --quiet --file demo-data/export-db.js` from `examination-service` to refresh) |
| Deployment kit | `deploy/` (launchers, `scripts/`, `demo-files/`, `README-SETUP.md`, `dms/README.md`) |

**Never in git (`.gitignore`):** `*.jar`, `examination-service/target/`, Imad's real `deploy/dms/edms/properties/*.properties` (JWT secret), `run-service.ps1`, `.env*`, logs, `.angular`, `node_modules`, `dist`. The DMS jar is Imad's and is copied by hand; keys are typed at start.

**Updating the demo laptop:** commit and push here, then `git pull` on the laptop (see `deploy/README-SETUP.md`). Only a `package.json` change needs `npm install` again.

A scan before the commit found one partial JWT secret in the copied `DEPLOYMENT.md`; it was masked in the repo copy only.

## 13. Moving the project to the demo laptop

**Before leaving this PC**, refresh the export (the saved one is from Sep 12):
```powershell
cd C:\Users\Usman\Downloads\edms-examination-service
mongosh --quiet --file demo-data\export-db.js
```
The export skips GridFS (original files of old scans); DMS document files are inline in `edms` and are exported.

**Copy**
- `PDF_Searcher`: `src`, `public`, `angular.json`, `package.json`, `package-lock.json`, `proxy.conf.json`, `tsconfig*.json`, and `node_modules` (748 MB) if the laptop has no internet. Skip `.angular` (517 MB cache), `dist`, `.git`.
- `D:\edms\properties`: the current JAR plus the two `.properties` files only.
- `edms-examination-service`: `target\examination-service.jar` and `demo-data\`. Skip `src`, logs, and `run-service.ps1` (keys).

**Laptop needs:** Java 17, Node 22.13.1, MongoDB 8.0.11 (installer at `D:\edms\mongodb-windows-x86_64-8.0.11-signed.msi`) and `mongosh`.

**Gotchas**
- The DMS JAR reads `file:d:/edms/properties/clientapplication.properties`. The properties must be at exactly `D:\edms\properties\`. With no D: drive, run `subst D: C:\demo-d` (resets on reboot).
- **Import the database before starting any backend** (`mongosh --quiet --file demo-data\import-db.js` from the examination-service folder). The import skips collections that already have rows, and the DMS creates users on first start.
- The `cors.allowed.origins` value names Imad's hostname (`DESKTOP-NHRT5O5`); harmless behind the dev proxy.
- `attachAuthToken: false` travels with the source.
- Do one full dry run on the laptop the night before. Vessel checks need internet.

## 14. Testing notes and traps

These cost hours in past sessions.
- **A hidden browser pane pauses `requestAnimationFrame`, so PDF.js rendering hangs and PDF scans never finish** (state stays "Loading document"). This only affects the Claude in-app browser when its pane is hidden. Workaround in a test: `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)` before uploading. A real browser is fine.
- **Clear `localStorage['documentReader.lastAnalysisId']` before the reload, not after.** The page restores the last analysis on load, and an upload during that restore races and silently dies.
- **Do not run `ng build` while `ng serve` is running.** They share `.angular/cache` and the dev server stops serving PDF.js correctly. Restart the dev server if that happens.
- In dev mode, inspect the reader with `window.ng.getComponent(document.querySelector('app-document-reader'))` (state, `anomalyReport`, `knownPorts`, and so on).
- **Do not probe `/dms/save` with test rows in the live DB.** Probing product codes wrote 8 junk rows once; they were deleted by filter (`PROBE-`, `TEST-NOAUTH-`, `TEST-CSRF-`). If you must probe, clean up right after.
- Re-uploading the same demo file makes the Duplicate Check card red ("exact file uploaded before"). That is correct behaviour.
- **Do not re-scan Bill of Lading files casually**: each scan spends DataDocked credits and OpenSanctions quota. To test the save path, restore an old analysis by setting `documentReader.lastAnalysisId` to its id and reloading.
- Browser test uploads: fetch a file from a temporary local server that sends `Access-Control-Allow-Origin: *`, wrap it in a `File`, set it on `input[type=file]` and dispatch `change`. Stop that server afterwards.
- Demo files in `C:\Users\Usman\Downloads`: `Complete_OCR_Import_LC_Bank_Format_Final_260917_230047.pdf` (best LC, 23 fields), `Complete_Realistic_Import_LC_OCR_MT700_260917_230607.pdf`, `Sample_Import_Letter_of_Credit_260917_225818.pdf`, `demo-test-bol.png`.

**End-to-end test:** log in, Document Scanner, upload the LC, wait about 30 seconds, check the Validation card, click Proceed and send the document to DMS, then check Mongo:
```bash
mongosh --quiet --eval "db.getSiblingDB('edms').documentmasterilc.find({tnxreference:/^SRT-ILC-/},{tnxreference:1,description:1,_id:0}).sort({_id:-1}).limit(2).forEach(printjson)"
```
then find the reference in the user portal (Search By Ref ID).

## 15. Known issues and to-do lists

### For Imad (backend)
1. **Fix the double `doFilter` in `JwtAuthenticationFilter`** (section 11), then tell us so `attachAuthToken` can go back to `true`.
2. **Create the BL, PO and RCP collections/classes** so those types can be filed under their own codes.
3. **Restore security** (the JAR is permit-all right now).
4. **Fix `demo-data` ports CSVs**: both `bank-ports.csv` and `ports-import-test.csv` lack the `category` column the importer requires, so they import zero rows.
5. `dms.products` in `clientapplication.properties` still lists only `CUS,MAA,SRT`; it is not what gates saving, but it should be tidied.
6. Real sanctions data sources for any customer use.

### For us (frontend / examination service)
- Admin Dashboard page is blank.
- Entity screening card and manual region selection are switched off.
- **Third-party ingest API** (Imad's idea): a partner POSTs a document, the examination service scans it and forwards it to the DMS with a Bearer token. Not started. Needs the field extraction and rules ported from TypeScript to Java (PDFBox, Tess4J for images). The plan discussed: first a small forwarding-only endpoint, then the full ingest after the demo. Note the double-`doFilter` bug affects any forward that sends a Bearer token.
- Cosmetic mis-extractions on the MT700 layout: `formOfCredit` can be `Form`, `confirmationInstructions` can be `Confirmation`, `applicationReference` can be `Document`, and `applicant`/`beneficiary` can start with the word "Applicant"/"Beneficiary".
- Extraction is regex based and only tested on three LC layouts plus a few BOL/invoice images. Measure it on real documents before quoting accuracy.

## 16. Field extraction reference

`src/app/core/services/field-extraction.service.ts`. Document types, in detection order: IMPORT_LETTER_OF_CREDIT (before LETTER_OF_CREDIT so the specific type wins), BILL_OF_LADING, LETTER_OF_CREDIT, PURCHASE_ORDER, INVOICE, BANK_STATEMENT, RECEIPT. Detection scores defining and supporting keywords.

**Regex conventions**
- Use `[^A-Za-z]+` to skip SWIFT tag separators such as ` / :44E: `.
- Use non-greedy `[^\n]*?` for dates. Accepted formats: `YYMMDD`, `DD-Mon-YYYY`, `DD Month YYYY`.
- OCR text often has no real newlines, so terminators are `A/C <id>` and the next `:NN[A]:` tag, not only `\n`.
- `applicant` uses a negative lookahead so `:51A: Applicant Bank` does not hijack `:50: Applicant`.
- `lcAmount` handles `:32B: Currency Code, Amount USD125000,00` (comma decimals). `amount` needs 2 or more digits to avoid stray "1".
- `partialShipments` / `transshipment` capture `ALLOWED`, `NOT ALLOWED`, `PERMITTED`, `PROHIBITED`, `CONDITIONAL`.

**SWIFT MT700 tags:** `:20:` credit number, `:31C:` issue date, `:31D:` expiry and place, `:32B:` currency and amount, `:39A:` tolerance, `:40A:` form of credit, `:40E:` applicable rules, `:41A:` available with, `:42C:` drafts at, `:43P:` partial shipments, `:43T:` transshipment, `:44A/B/C/D/E/F:` taking in charge / final destination / latest shipment / shipment period / port of loading / port of discharge, `:45A:` goods, `:46A:` documents, `:47A:` additional conditions, `:50:` applicant, `:51A:` applicant bank, `:53A:` reimbursing bank, `:57A:` advising bank, `:59:` beneficiary, `:71B:` charges.

**Validation rules** (`anomaly-detection.service.ts`, type-aware since 2026-09-19): a document date is required (accepts `date`, `issueDate`, `dateOfIssue`, `invoiceDate`, `receiptDate`); a document identifier is required (accepts `documentId`, `statementId`, `lcNumber`, `blNumber`, `invoiceNumber`, `poNumber`, `receiptNumber`, `documentNumber`); an amount is a warning if missing (accepts `amount`, `lcAmount`, `invoiceAmount`, `totalAmount`); `accountNumber` is required only for BANK_STATEMENT. Other rules: date and account formats, future dates, negative / zero / very small / very large amounts. `buildExtractionObject()` passes `documentType` so the detector picks the right set.

Other UI rules: OCR confidence is stored 0 to 1 (PDF embedded text is 1); the template caps display at 100%.

## 17. Common errors and what they mean

| Message | Meaning | Fix |
|---|---|---|
| "Http failure during parsing" on list pages | Imad's JAR doubles the body when an Authorization header is sent | `attachAuthToken: false` (temporary), fixed JAR later |
| "Failed to upload file" on save, HTTP 500 | Product code has no backend collection (BL, PO, RCP) | Falls back to SRT in the frontend; Imad builds the collections |
| "Not enough credits or endpoint in black list" | DataDocked balance exhausted or key blocked | Top up or new key, restart the examination service with it |
| "OPENSANCTIONS_API_KEY not configured" | Service started without the env var | Restart with both variables set |
| Save returns 404 | Backend does not know the route or code | Check the code against the probe results in section 9 |
| Scan stuck on "Loading document" in the in-app browser | Hidden pane, no `requestAnimationFrame` | Section 14 workaround |
| Reader shows an old document after reload | `documentReader.lastAnalysisId` restore | Click Clear, or remove that localStorage key before reloading |
| Import "0 added, 0 updated, N skipped: category must be SANCTIONED or HIGH_RISK" | CSV missing the `category` column | Add the column |
| DMS JAR fails to start on another machine | Config path `d:/edms/properties/...` not found | Section 13 (D: drive or `subst`) |

## 18. Uncommitted work inventory

Until 2026-09-20 nothing from these sessions was committed (last commit `d4ab65f`). On 2026-09-20 the work was committed locally in logical groups for the new `docfinder` repo (section 13a); check `git log` and `git status` for the current state.

Modified: `angular.json`, `package.json`, `package-lock.json`, `proxy.conf.json`, `src/app/app.routes.ts`, `src/app/core/interceptors/auth.interceptor.ts`, `src/app/core/page-layout/page-layout.component.ts`, `src/environments/environment.ts`, `src/environments/environment.prod.ts`, `src/app/pages/USER/user-dashboard/user-dashboard.component.ts` and `.html`.

Untracked: `.claude/`, `PROJECT_ARCHITECTURE.md`, `public/tesseract/`, `src/app/core/services/` (`anomaly-detection`, `compliance`, `document-analysis`, `duplicate-detection`, `field-extraction`, `ocr`, `vessel` services), `src/app/pages/ADMIN/compliance-data/`, `src/app/pages/ADMIN/document-scanner/`.

Other files changed outside this repo: `edms-examination-service\run-service.ps1` (API keys updated), and `D:\edms\properties\dmsclientext-0.0.1.jar` replaced by Imad's 2026-09-19 build (the previous one is kept as `.bak-*` files there).

## 19. Business and legal notes

Discussed on 2026-09-20 (not decisions):
- Best positioning: compliance screening at document intake on top of a DMS, for bank trade-finance operations. Sell through a paid pilot; the bank's own CSV lists and the offline option (`sanctions.source=local`) are selling points.
- **Before charging money:** turn security back on, replace the illustrative lists with real sources, check the **commercial licence terms of OpenSanctions and DataDocked** (trial tiers usually do not cover reselling), settle **ownership of the DMS JAR** with Imad in writing, and measure extraction accuracy on real documents.

## 20. Session history

- **2026-09-20 (evening, Imad's feedback):** Imad asked for the deck and the app to (1) say "Proceed and send the document to DMS" instead of "Proceed and Save", (2) mention that a transaction processing system can send documents to the DMS through a **REST API** (the DMS upload call already exists; it is what we test from Postman), (3) mention a **document migration utility** for moving documents from a legacy system into the DMS (Imad's own utility, **outside the DMS screens**, not built into this app), and (4) mention that compliance data can be managed **locally (CSV upload) or externally through the API** (`POST /compliance/countries/import` and `/ports/import` already exist). Done: app wording changed, the deck now has 14 slides with a new "Three ways documents get in" slide, the Extracted-fields text no longer repeats "confidence", the "Saved" card says the analysis report is saved on the server and can be loaded or extracted on demand, and the search slide says "transaction reference". The user then approved filing the analysis report in the DMS under SRT, and it was implemented and tested the same evening (section 9).

- **2026-09-18:** Added Import LC detection and SWIFT MT700 patterns; auth interceptor logs out only on 401; product-code mapping and dynamic Proceed button; wrote the first version of this file.
- **2026-09-19:** Scanner UI fixes (banner, feedback cards, layout bug where blocks fell into the empty grid column); type-aware validation; OCR confidence fix; regex fixes (applicant, amounts, shipments); Imad's permit-all JAR installed; the false "CSRF" diagnosis corrected; found the double-`doFilter` bug and added `attachAuthToken`; `SRT-` reference prefix; vessel and OpenSanctions keys sorted; user portal and admin lists verified.
- **2026-09-20:** User dashboard search box fixed to use the real DMS search; Compliance CSVs imported and verified; compliance gap fixed (port names and countries from port text); restore keeps compliance flags; BL/PO/RCP fall back to SRT after a live probe of the backend; new DataDocked key installed; demo deck built as a claude.ai artifact (https://claude.ai/artifact/5duEWFqHyje5kjYNH34ha8, 13 slides, PDF download chosen over .pptx); deployment runbook for the demo laptop written; this file rewritten and secrets removed.

---

## Quick reference for a new chat

1. Read this file, then run the health check in section 12 (servers stop between sessions).
2. Read section 2 (how the user works) before doing anything: **analyse existing code and report, do not build unrequested things; do not commit; keep answers short.**
3. The DMS JAR is Imad's and has **no source here**. Never try to fix backend security or collections from Angular. Send Imad a short Roman Urdu / English message instead.
4. `attachAuthToken` in `environment.ts` is a **temporary** workaround for Imad's filter bug. Do not remove the flag until the fixed JAR arrives.
5. Do not spend DataDocked or OpenSanctions calls on casual testing.
6. Do not write API keys, JWT secrets or passwords into any file.
7. Before recommending a path, flag or function from this file, check it still exists. This document is a snapshot.
