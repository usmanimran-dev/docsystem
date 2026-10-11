# DocuFinder: setup and updates on the demo laptop

**The front end and the back end are two separate folders.** This one holds the
back end, the deployment scripts and the demo database. The Angular app lives
in its own repository.

## Layout

Put the three folders side by side. The launcher scripts assume this:

```
C:\docfinder\           <- front end   (git clone, port 4200)
C:\docfinder-backend\   <- this folder (back end + deploy kit, port 8090)
C:\edms-dms\            <- Imad's DMS jar and config     (port 8082)
```

| Path | What it is |
|---|---|
| `..\docfinder` | The Angular app (port 4200) — separate repo: `github.com/usmanimran-dev/docfinder` |
| `examination-service` | Java source of the examination service (port 8090), plus `demo-data` (CSVs and the database export in `demo-data\db-export`) |
| `deploy` | The `.bat` launchers, the PowerShell scripts, the demo documents (`deploy\demo-files`) and this guide |
| `..\edms-dms` | Imad's DMS jar and config (port 8082) — its own folder, never in git |

If you keep either folder somewhere else, set `DOCFINDER_FRONTEND` or `EDMS_DMS`
to its path before running the launchers.

## Manual items (never in git)

| Item | Where it goes | How often |
|---|---|---|
| Imad's DMS (jar + two `.properties`, which hold his JWT secret) | the `edms-dms\` folder, beside this one | Once, and again only when Imad ships a new jar |
| `examination-service.jar` | `examination-service\target\` | Once, and again only if the Java code changes (or build it with Maven) |
| API keys (DataDocked, OpenSanctions) | Typed when `START-2` runs | Every start |
| Java 17, Node 20+, MongoDB 8.0.11, `mongosh`, Git | Installed on the laptop | Once |

## First-time setup on the laptop

1. Install Java 17, Node 20 or later, MongoDB 8.0.11 (as a service), `mongosh` and Git.
2. Clone the front end into a **short path** (Windows has a path length limit),
   and copy this back-end folder in beside it:

   ```powershell
   cd C:\
   git clone https://github.com/usmanimran-dev/docfinder.git
   # then copy docfinder-backend\ to C:\docfinder-backend
   ```

   You should end up with `C:\docfinder`, `C:\docfinder-backend` and `C:\edms-dms`.

3. Copy the manual items above into place.
4. Double-click **`deploy\SETUP-database.bat`** once. It imports the demo database and skips any collection that already has rows.

## Start (every time, three windows, in this order)

1. `deploy\START-1-dms.bat`, then wait about 20 seconds.
2. `deploy\START-2-examination-service.bat`, paste the two keys, then wait about 20 seconds.
3. `deploy\START-3-frontend.bat`. The first run does `npm install` (needs internet) and takes a few minutes. Then open http://localhost:4200.

`deploy\CHECK-everything.bat` shows what is up.

If the laptop has no `D:` drive, `START-1` maps one to `edms-dms\` for the session (run it again after a reboot). The DMS jar reads its config from `D:\edms\properties\`.

## Database

One MongoDB on `localhost:27017`, two separate databases — the split matters:
our service never touches Imad's data.

| Database | Owned by | Port | Config |
|---|---|---|---|
| `edms` | Imad's DMS | 8082 | `spring.mongodb.uri` in `clientapplication.properties` |
| `edms_examine` | our examination service | 8090 | `spring.data.mongodb.uri` in `application.properties` |

`edms` holds `usermaster` (logins), `departmentmaster`, `documenttypemaster`
and one `documentmaster<product>` collection per product code (`ilc`, `srt`,
`cus`, ...). `edms_examine` holds `document_analyses`, `discrepancy_reports`,
the uploaded files (GridFS, `fs.files`/`fs.chunks`), and four compliance
tables: `sanctioned_countries`, `sanctioned_ports`, `hs_code_pricing`,
`sanctioned_hscode_countries`.

The four compliance tables **self-seed**: `examination-service.jar` fills each
one on first boot if it is empty, with no need to run the setup script first.
`SETUP-database.bat` on top of that imports the demo accounts and demo
documents from `demo-data\db-export` — and, same as the compliance tables,
only into collections that are still empty. It never overwrites a collection
that already has rows, so running it again on a laptop that already has data
does nothing (you will see `skipped ... already has N documents` for
everything).

To reset a database to the demo export, drop it first — see "Getting an
update from your main PC" below.

## Getting an update from your main PC

On the main PC: `git add`, `git commit`, `git push`.
On the laptop:

```powershell
cd C:\docfinder
git pull
```

The running dev server reloads the page by itself. Only if `package.json` changed, run `npm install` again. If the database export changed and you want it, drop the two databases (`db.getSiblingDB('edms').dropDatabase()` and the same for `edms_examine` in `mongosh`) and run `SETUP-database.bat` again. **That deletes the laptop's data.**

## Logins

| Portal | Login ID | Password |
|---|---|---|
| Admin | `admin` | `DocuFinderDemo1` |
| User | `normaluser` | `DocuFinderDemo1` |

> **On a laptop set up before this change, these are still the old passwords.**
> `SETUP-database.bat` skips any collection that already has rows, so a database
> seeded earlier keeps the hashes it was seeded with. To pick up the new ones,
> drop the `usermaster` collection and re-run the script — that resets the demo
> accounts only. Do not run it against anything other than the local demo
> database.

Every account in the demo export now uses the same password, `DocuFinderDemo1`.
It is deliberately public: the export previously shipped the real bcrypt hashes
of twelve accounts, including named people, and a password reused on another
system would have been exposed to anyone holding a copy of the repository. The
hashes were regenerated by
`examination-service\demo-data\regenerate-demo-passwords.js`; re-run it if you
ever need to change the demo password.

These accounts are for a throwaway demo database on a local machine. Do not
reuse this password for anything else, and do not point the demo at a real DMS
database.

## Quick test

1. Log in as `admin`, open **Document Scanner**, upload `deploy\demo-files\Complete_OCR_Import_LC_Bank_Format_Final_260917_230047.pdf`.
2. After about 30 seconds you should see the extracted fields and a Validation card with sanction and high-risk flags.
3. Click **Proceed and send the document to DMS (ILC)** and copy the `SRT-ILC-...` reference. Two records are filed under it: the document, and its analysis report under SRT.
4. Log out, log in as `normaluser`, paste the reference into the dashboard search, and open the documents.

## Things to know

- **Private repository.** `examination-service\demo-data\db-export` contains user accounts. The hashes there are now throwaway ones, but the originals are still in the git history, so keep this repo private.
- Vessel and ownership checks need internet and DataDocked credits. Do not scan the bill of lading repeatedly.
- The frontend has a temporary setting, `attachAuthToken: false` in `src\environments\environment.ts`, that works around a bug in Imad's DMS jar. Leave it as is until he ships a fixed jar.
- Do not run `ng build` while the app is running (they share a cache).
- More detail: `PROJECT_ARCHITECTURE.md` at the repo root.

## Network settings

**For the demo on a laptop, set none of these.** The defaults are what the
`.bat` launchers expect: both services bind to `127.0.0.1` and run with their
key checks off, which is safe precisely because nothing outside the machine can
reach them. Each service prints a warning at startup saying so.

They only matter when a service has to be reachable from another machine. Then
bind it *and* set its key — never one without the other.

| Variable | Service | Default | What it does |
|---|---|---|---|
| `SERVER_BIND_ADDRESS` | examination (8090) | `127.0.0.1` | Interface to listen on. `0.0.0.0` exposes it to the network. |
| `EXAMINATION_API_KEY` | examination (8090) | unset | When set, every request needs a matching `X-API-Key` header. Unset disables the check. |

If you set `EXAMINATION_API_KEY`, the dev server has to send it too — set the
same value in the shell you run `npm start` from, and `proxy.conf.js` adds the
header. In a real deployment the reverse proxy adds it instead. The key must
never go into `src\environments\` : anything compiled into the Angular bundle is
readable in the browser's network tab and is not a secret.
