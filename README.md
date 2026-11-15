# PCCI M&E Portal

A mobile-first monitoring, evaluation, accountability, and learning workspace for Liberia’s Presidential Clean Cities Initiative, Ministry of State for Presidential Affairs.

The portal includes a clearly labelled public preview with illustrative reporting data. Official user accounts, reports, location records, audit events, survey responses, and community feedback are stored in Netlify Database. Sample reports are never inserted into the operational database.

## Technology and deployment

The client uses React, Vite, TypeScript, Tailwind CSS, a shadcn-style Radix/CVA button component, Lucide icons, Recharts, and Leaflet with OpenStreetMap tiles. Express runs the API on Netlify Server under `/api/*`. A scheduled Netlify Function handles weekly summary emails. PostgreSQL is accessed through `@netlify/database` and Drizzle’s Netlify adapter. Photographs are stored in Netlify Blobs and served through authenticated API routes.

`netlify.toml` declares the Vite build, static publish directory, Node 24 runtime, API server path, and security headers. There is deliberately no catch-all SPA rewrite intercepting `/api/*`. Client navigation uses application state on `/`; public feedback is available at `/?feedback=1`.

## Run locally

Use Node.js 24 or later and install dependencies with `npm ci`. Link to the Netlify project using the Netlify CLI, then run:

```sh
netlify dev --port 8889
```

The Netlify CLI provides platform integration. Opening Vite by itself does not emulate Database, Blobs, or the API. Configure the required environment variables for the development context through Netlify’s environment settings; do not commit credentials.

The deployment pipeline runs `npm run build`. No build, test, type-check, or development server was run during initial implementation; source files and generated migrations were reviewed directly.

## Environment variables

The application requires sign-in before displaying any workspace, dashboard, reports, maps, or administrative screens. Guests cannot browse sample data or submit feedback. Super Admins create accounts and manage roles and access from **Users & roles**; public registration is disabled. To enable the first real administrator, configure `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD`. Existing accounts continue working if bootstrap settings are removed. Without an existing account or completed bootstrap configuration, the portal stays on the sign-in screen.

Set `RESEND_API_KEY`, `EMAIL_FROM`, and `WEEKLY_SUMMARY_TO` to enable weekly emails. Until then, authenticated Settings displays a labelled sample email, and the scheduled function returns a preview response without contacting an email provider.

| Variable               | Purpose                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`       | Cryptographically random JWT signing secret, at least 32 characters. A secret was generated and configured for production and deploy previews during setup. |
| `SUPER_ADMIN_USERNAME` | Username for the first Super Admin. Case-insensitive; stored in lowercase.                                                                                  |
| `SUPER_ADMIN_PASSWORD` | Initial password, at least 12 characters and no more than 72 UTF-8 bytes because bcrypt truncates beyond that limit. Store as a secret.                     |
| `SUPER_ADMIN_NAME`     | Optional display name; defaults to PCCI Administrator.                                                                                                      |
| `RESEND_API_KEY`       | Secret Resend API key for scheduled weekly summary delivery.                                                                                                |
| `EMAIL_FROM`           | Sender email address on a verified Resend domain.                                                                                                           |
| `WEEKLY_SUMMARY_TO`    | Comma-separated, authorized recipients for the national summary.                                                                                            |

The first login request seeds the initial Super Admin only when no Super Admin exists. Changing the bootstrap password variable later does not reset an existing account. Set up subsequent accounts from **Users & roles**. Remove bootstrap credentials from the environment after successfully establishing administrator access if your operational policy requires it.

Database connection and Blobs access are supplied by Netlify; no database URL or storage token is required in application code. Do not expose any server variables through a `VITE_` prefix.

## Database and location seeds

`db/schema.ts` is the source of truth. The generated migration lives in `netlify/database/migrations/` and is applied by Netlify at deployment. For future schema changes, update the schema and run `npm run db:generate -- --name descriptive_change`. Drizzle packages intentionally use the beta channel required by the Netlify adapter.

Initial locations cover Montserrado (Monrovia and Paynesville), Margibi (Kakata), and Grand Bassa (Buchanan). Login and the location directory idempotently seed the hierarchy. Coordinates are starter city/market approximations rather than surveyed locations; replace them with verified field coordinates before operational analysis.

Download the example CSV at `/data/locations-template.csv`. Imports accept `id,name,type,parentId,county,city,latitude,longitude`. Valid levels are County, City, District, Community, Market. Import parents before children and use consistent county/city names. Duplicate IDs are skipped. Imports are processed in order; a validation error leaves earlier valid rows imported.

## Accounts and permissions

| Role              | Access                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin       | User lifecycle, role/scope assignments, administrator password resets, reports and approval, locations, national MEAL configuration, audit log. |
| Admin/M&E Officer | Reports and approval within assigned scope, location management, national MEAL administration, audit log.                                       |
| City Verifier     | Scoped report viewing, city verification with typed e-signature and position, return comments.                                                  |
| Team Supervisor   | Create and update own Draft/Returned reports within assigned scope, submit for verification.                                                    |
| Viewer            | Read scoped reports, maps, analytics, and exports.                                                                                              |

County and city scope is enforced by the API on report and location access. MEAL tools are a national administrator workspace; they are not divided by geographic scope. User administration is restricted to Super Admins. Accounts owning reports must be deactivated instead of deleted to preserve report ownership.

Passwords use bcrypt with cost 12. JWTs are stored in an httpOnly, Secure, SameSite=Strict cookie with a 30-minute absolute lifetime. A 29-minute inactivity timeout clears the browser workspace. Protected API failures require sign-in again. Password changes, resets, deactivation, and sign-out invalidate sessions via a database version counter. Login attempts are throttled in the database, and state-changing browser requests are checked for same-origin access. Recovery is administrator-assisted: users contact a Super Admin, who verifies identity and resets the password in Users & roles. Self-service email recovery is not included.

API access and workflow actions are recorded in the audit log. The interface displays the latest 500 audit events. Audit entries do not store passwords or tokens.

## Field reporting and workflow

The editor captures team/location details, Daily/Weekly periods, supervisor contacts and GPS; eight progress indicators; gender-disaggregated attendance and PPE; repeatable sanitation/awareness activities; equipment; challenges/escalations; checklists; and before/after photographs. Multiple sanitation activities can be selected per site. Photographs require an online, saved Draft/Returned report and are limited to 5 MB each.

Drafts may be incomplete. Submission requires team, county, city, supervisor, and reporting period. Workflow transitions are enforced server-side:

**Draft → Submitted → City Verified → Admin Approved**, with **Returned** available to reviewers and correction comments required. City verification records the authenticated verifier, position, typed signature, and server timestamp. Returned reports can be edited and resubmitted. Report numbers are generated on the server. Version checks prevent silent overwrites of concurrent edits.

The dashboard counts only approved results for KPIs. Cumulative absolute measures add this period to approved reports; youth, CBO, and PPE percentages use an unweighted mean because denominator definitions were not supplied. Field entries are period results, not already accumulated totals. Avoid overlapping Daily and Weekly reports for the same activities to prevent double-counting. Awareness reach totals sum rows; they do not deduplicate individual citizens. Cost productivity assumes USD and uses entered cost divided by waste tonnage. Forecasts estimate the number of comparable reports remaining, not a statistically validated completion date. Non-approved reports whose period ended more than seven days ago are flagged as overdue; team scheduling and missing-report detection require an agreed roster/cadence.

## Offline operation and exports

The service worker caches the app shell and same-origin static assets after first online use; it never caches API responses. IndexedDB saves drafts per signed-in user on the current device. Edits autosave locally after one second and queue for synchronization. Closing the editor triggers sync when online. Reconnecting while an editor is open defers sync until it closes to avoid racing active edits. An expired session requires online sign-in before sync.

Offline draft capture works in an already opened, signed-in workspace. Offline cold-start authentication and rehydration of the full reporting workspace are not included. Photographs and verification/approval require connectivity. Draft conflicts are retained locally and reported instead of overwritten; reconcile against the current server version before retrying. Browser storage can be cleared by the browser or device owner and is not a replacement for synchronization. Shared field devices should use separate browser profiles.

The Reportal exports filtered registers to CSV, XLSX, or PDF. Individual reports export to a branded PDF containing the requested sections, progress calculations, review history, and available photo attachments. The original paper form was not supplied, so exact page-for-page facsimile layout is not established.

## Maps and analytics

The map provides teams, sanitation sites, drainage activities, awareness locations, markets, a waste-intensity heatmap, before/after condition colours, and boundary coverage shading. It reports communities without approved activity, nearest-market straight-line distances, and 1 km greedy activity clusters. These are descriptive planning aids; repeated reports can describe the same physical site, road distances are not calculated, and clusters are not a statistical significance test.

County and district polygons come from geoBoundaries gbOpen Liberia ADM1/ADM2 (CC BY 4.0): https://www.geoboundaries.org/. Names must align with directory names for matching. The available city polygon is Kakata, sourced from OpenStreetMap/Nominatim; other city outlines were unavailable and were not fabricated. OpenStreetMap tiles and city geometry are © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. County/district shading is by approved-report counts, not a population-adjusted performance index. Online access is required for uncached map tiles.

Analytics include target attainment, city and team rankings, gender attendance, PPE, waste types, awareness reach, behaviour-change ratings, district approval signals, and cost per ton. Filters apply to displayed reports and exports. Custom indicators are stored as administrator definitions and do not replace the eight fixed programme KPI targets.

## MEAL and weekly summaries

Administrators can create indicators with baselines/targets and design surveys using text, number, yes/no, rating, and date questions. Responses are validated and persisted. Grievances, lessons learned, and actions support Open, In progress, Resolved, and Closed statuses, assigned owners, and due dates. The public feedback page accepts anonymous community concerns, returns a reference ID, and appears through a QR code in MEAL tools. The reference ID is not a public status lookup or authentication credential.

The `weekly-summary` Netlify Function runs at 08:00 UTC each Monday on production. It emails a national, aggregate summary of reports updated in the preceding seven days through Resend, using an idempotency key per date, and records successful delivery in the audit log. Delivery requires the configured API key, verified sender, and approved recipients. Email delivery, database migrations, browser workflows, and platform integration still require deployment/runtime verification.
