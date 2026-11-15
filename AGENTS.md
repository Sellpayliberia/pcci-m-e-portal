# Project architecture

PCCI M&E Portal is a React/Vite/TypeScript SPA for Liberia’s Presidential Clean Cities Initiative. The UI is an operations workspace in navy, white, muted red, and green. Keep new screens mobile-first and consistent with the existing compact dashboard.

## Key directories

- `src/main.tsx`: application shell, dashboard, Reportal, map/analytics, report editor, user/location administration, MEAL, account settings, public feedback.
- `src/components/ui/button.tsx`: Radix Slot/CVA button and shared class utility, following shadcn conventions.
- `src/styles.css`: responsive interface styles and Tailwind import. DM Sans/Manrope fonts have generic fallbacks.
- `src/data.ts`: fixed programme indicators, empty-report factory, aggregation helpers, and explicitly illustrative preview data. Never insert sample reports into operational storage.
- `src/lib.ts`: authenticated API client, IndexedDB draft queue, CSV/XLSX/PDF exports.
- `src/site.ts` and `index.html`: finished title and share-description copy.
- `db/schema.ts`: Drizzle schema; `db/index.ts`: reusable database client.
- `netlify/server/index.mjs`: Express API, custom bcrypt/JWT auth, access controls, bootstrap, workflow, persistence, and protected photo delivery.
- `netlify/server/validation.mjs`: Zod validation; `seed.mjs`: idempotent location seeds.
- `netlify/functions/weekly-summary.mts`: Monday 08:00 UTC Resend email summary.
- `netlify/database/migrations/`: generated Drizzle migrations; never modify applied migrations.
- `public/`: PWA shell, icon, cached static boundaries, sample location CSV.

## Runtime and conventions

Production requires Node 24. Netlify Server owns `/api/*`; do not add a catch-all static rewrite or full-stack framework function that intercepts its routes. Functions are for scheduled work. All durable structured records belong in Netlify Database using its native Drizzle adapter, with beta Drizzle packages. Photos belong in Netlify Blobs with database ownership records. Keep uploads private behind the API.

Custom username/password authentication was explicitly requested. It uses bcrypt, an httpOnly JWT cookie, database session invalidation, and server-side role/geographic permissions. Do not substitute client-only authorization or enable public account registration. Never return password hashes or tokens, log credentials, or expose server variables to Vite. API routes must validate inputs and enforce role/scope independently of UI controls. Browser same-origin checks and strict cookies protect mutations.

Keep report workflow transitions and signatures server-controlled. Preserve review history on draft saves. Check report versions on updates to detect conflicts. Do not silently overwrite offline conflicts. Queue drafts by user ID; never cache authenticated API responses in the service worker. Official KPIs use approved records only, and percentage averaging is currently unweighted. Definitions and operational limitations are in README.md.

Boundary shading uses source polygon names. There is one available city polygon (Kakata); do not fabricate other boundaries. Map spatial calculations are descriptive and use Haversine straight-line distances.

Use imports and types consistent with the surrounding code. Keep migrations generated from the schema. The initial migration was generated, not manually authored. No build, test, type-check, or development server was run during initial creation under the platform run constraints; rely on deployment checks and review current run instructions before executing validation.
