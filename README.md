# DocuFinder — back end

Everything that is not the Angular app. The front end is a separate
repository: <https://github.com/usmanimran-dev/docfinder>.

## Put the two folders side by side

```
Downloads\
├── docfinder\           front end   (git clone)
└── docfinder-backend\   this folder
```

`START-3-frontend.bat` expects that layout. To keep the front end somewhere
else, set `DOCFINDER_FRONTEND` to its path.

## What's in here

| Folder | What |
|---|---|
| `examination-service/` | Java 17 / Spring Boot, port **8090**. Stores analyses and discrepancy reports, holds the sanctions and ports tables, serves the admin monitoring figures. Needs MongoDB on `:27017`. |
| `deploy/` | `.bat` launchers, PowerShell scripts, demo documents, and the MongoDB seed. Start with `deploy/README-SETUP.md`. |
| `ARCHITECTURE.md`, `PROJECT_ARCHITECTURE.md`, `CONTRIBUTING.md`, `TASKS.md` | Design notes and the list of known gaps. |

## The third service

`START-1-dms.bat` runs **Imad's DMS jar** on port **8082** — user accounts,
login, and the document store. It is not ours and lives in its own folder,
`edms-dms\`, expected beside this one. See its README.

So a working machine runs three things:

| Port | Service | Comes from |
|---|---|---|
| 8082 | DMS | Imad's jar, copied by hand |
| 8090 | Examination service | `examination-service/` here |
| 4200 | Angular app | the `docfinder` repo |

## Building

```bash
cd examination-service
mvn clean package          # -> target/examination-service.jar
```

Neither jar is committed — `.jar` files are too large for git and the DMS jar
is not ours to distribute.

## What is deliberately not here

`ingest-service` — a Node headless API that lets a third party submit a
document over REST. Nothing in the app calls it, so it is not part of a
deployment. Its source is in the original `PDF_Searcher` repository
(commit `94558d2`) if it is ever needed again.

## Not in git

This folder is deliberately **not** a git repository. The demo database export
under `examination-service/demo-data/` contains password hashes, so it should
not be pushed anywhere without dealing with those first.
