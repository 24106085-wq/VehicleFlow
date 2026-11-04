# VehicleFlow – Vehicle Service Center Management with Agile (Kanban + Scrum)

## Overview
VehicleFlow manages a vehicle service center. Customers book services, the admin runs a Kanban board, mechanics update repairs, and the team plans its own development work in a separate Scrum module. It is a college Agile mini-project.

## Problem statement
Service centers track bookings on paper or chat, so customers cannot see progress, work gets overloaded and nobody knows the true status of a vehicle. Software teams building such a system also need a visible, repeatable way to plan and review their work.

## Objectives
- One place for customers, mechanics and admin to follow a vehicle from booking to delivery.
- Limit work in progress with a Kanban board and WIP limits.
- Demonstrate Scrum practically: backlog, sprint planning, sprint board, daily scrum, burndown and retrospective.

## Main features
- **Roles:** Admin, Mechanic, Customer (JWT login, permissions enforced on the backend).
- **Customer:** register, add vehicles, book services, track the five service stages.
- **Mechanic:** see assigned jobs, start repair, mark completed, add notes; view assigned sprint tasks.
- **Admin:** vehicle-service Kanban board (assign mechanics, move cards, WIP limits, activity history, search by plate) and the full Scrum module.
- **Scrum module:** Scrum Dashboard (with completed sprint history), Product Backlog, Sprint Planning (capacity enforced by the API), Sprint Board, Daily Scrum, Burndown chart, Retrospective.

## Technology stack
React + Vite + Tailwind CSS + Recharts (frontend) · Node.js + Express (backend) · **SQLite** (`better-sqlite3`, one local file, no database server) · JWT + bcrypt · Docker + Docker Compose (nginx serves the built frontend).

## System architecture
```
React SPA (frontend)  --HTTP/JSON-->  Express REST API (backend)  --SQL-->  SQLite file
  pages, role-based routes             /api/auth /vehicles /bookings        vehicleflow.db
                                       /dashboard /board /scrum             core + Kanban + Scrum tables
```
```
vehicleflow/
├── docker-compose.yml  .env.example  .dockerignore
├── database/schema.sql                     (SQLite schema; applied automatically by the backend)
├── backend/Dockerfile  scripts/ e2e-smoke.js backup.js
├── backend/src/  server.js db.js bootstrap.js middleware.js seed.js demoData.js migrate.js serviceFlow.js scrumUtil.js routes/*.js (+ *.test.js)
├── frontend/Dockerfile  nginx.conf
└── frontend/src/ App.jsx auth.jsx api.js components/ pages/ pages/scrum/
```

## Database structure
- **Core:** `users` (role: admin/mechanic/customer), `customers`, `mechanics`, `vehicles`, `service_categories`, `service_bookings` (status = Kanban stage, `priority`), `service_tasks`, `notifications`.
- **Kanban:** `kanban_wip_limits` (limit per column), `service_activity` (history of changes on each booking).
- **Scrum:** `product_backlog`, `sprints`, `sprint_tasks`, `daily_scrum`, `sprint_retrospectives`. Team members are existing `users` (admin/mechanic).

## Vehicle Kanban workflow
`Booking (pending) → Inspection (confirmed) → Repairing (in_progress) → Quality Check (completed) → Delivered`
- A new booking appears in the Booking column (the board also refreshes every 30 seconds).
- Assigning a mechanic to a Booking card moves it to Inspection.
- Cards move **one stage at a time** (forward or back); skipping stages is rejected by the API. A mechanic must be assigned before Repairing. Delivered bookings cannot be cancelled.
- The mechanic moves Inspection → Repairing → Quality Check; the admin moves Quality Check → Delivered.
- WIP limits are shown per column and warn when reached or exceeded.
- Each card has a **History** link (created, assigned, moved, priority, notes).

## Scrum methodology in the project
1. **Product Backlog:** user stories with priority, story points (1,2,3,5,8), description, acceptance criteria.
2. **Sprint Planning:** create a sprint (goal, dates, capacity), add stories, assign members. Adding stories beyond the capacity is rejected by the API. Only one sprint can be active; planned/active sprints cannot overlap.
3. **Sprint Board:** To Do → In Progress → Review → Done, with Blocked flag and comments (separate from the service Kanban).
4. **Daily Scrum:** yesterday / today / blockers, one entry per person per day.
5. **Burndown chart:** remaining points per day from real task data (a task counts when it reaches Done and stops counting if moved back).
6. **Sprint completion:** done stories stay Done, unfinished stories return to the Product Backlog marked "Returned from <sprint>" and can join a future sprint. Completed sprints keep their records.
7. **Retrospective:** went well / did not go well / improve; admin can turn feedback into a backlog item.

## Run with Docker (recommended)

Needs only **Docker Desktop** (running) on Windows. All commands are for **Windows PowerShell**, run from the project folder (the one containing `docker-compose.yml`).

```
Browser ──► frontend (nginx, :8080) ──/api──► backend (Express, :5000 inside Docker, published on host :5001) ──► /app/data/vehicleflow.db (SQLite)
                                                                              └─ Docker volume vehicleflow_sqlite_data
```
- Only **two containers**: `frontend` and `backend`. There is no database container.
- The browser only talks to `http://localhost:8080`. nginx serves the React app and forwards `/api` to the `backend` container, so there are no localhost/CORS mistakes between containers.
- The database is a single file, `vehicleflow.db`, inside the named Docker volume `vehicleflow_sqlite_data` (mounted at `/app/data` in the backend container). It survives stop, restart, container recreation, image rebuilds and `docker compose down`.

### Initial setup (once)
```powershell
cd "C:\Users\Vedant Mayekar\Downloads\vehicleflow_docker"
Copy-Item .env.example .env                                                  # 1. create your settings file
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"     # 2. generate a secret (prints a long text)
notepad .env                                                                 # 3. paste it after JWT_SECRET= and save
docker compose config --quiet                                                # 4. validate the configuration (prints nothing when valid)
docker compose up -d --build                                                 # 5. build and start
docker compose ps                                                            # 6. wait until both containers show "healthy"
```
Then open **http://localhost:8080**. On the very first start, with an empty database and `SEED_DEMO_DATA=true`, the demo data is added automatically.
Demo logins: `admin@vehicleflow.com / Admin@123` · `ravi@vehicleflow.com / Mech@1234` · `priya@example.com / Cust@1234`

Check health:
```powershell
docker compose ps
Invoke-RestMethod http://localhost:5001/health            # {"ok":true,"status":"ok","db":"connected",...}
Invoke-WebRequest http://localhost:8080 -UseBasicParsing | Select-Object StatusCode
```

### Everyday usage
```powershell
docker compose up -d                 # start the application
docker compose stop                  # stop (keeps containers and data)
docker compose restart backend       # restart one service
docker compose ps                    # container status and health
docker compose logs -f               # follow all logs (Ctrl+C to stop following)
docker compose logs --tail 100 backend
docker compose down                  # remove containers and network; the database volume is KEPT
```
> **Never run `docker compose down -v` or `docker volume rm`** unless you really want to delete the database. Normal `docker compose down` keeps the `vehicleflow_sqlite_data` volume, so all customers, vehicles, bookings, Kanban and Scrum data are still there after the next `docker compose up -d`.

Containers use `restart: unless-stopped`, so they come back after a crash or after Docker Desktop restarts.

### Development updates
```powershell
docker compose up -d --build frontend    # rebuild + restart only the frontend after changing frontend/ files
docker compose up -d --build backend     # rebuild + restart only the backend after changing backend/ files
```
The database volume is not touched by rebuilds.

### Database (SQLite)
- **Location:** `/app/data/vehicleflow.db` inside the backend container = Docker volume `vehicleflow_sqlite_data`. For runs without Docker: `backend/data/vehicleflow.db`.
- **Created automatically** on first start. Migrations run every start, are recorded in the `schema_migrations` table, and only add missing tables/columns - they never drop or delete anything. Run them manually with `docker compose exec backend npm run migrate`.
- **Demo data** is added only to a completely empty database (and only when `SEED_DEMO_DATA=true`).

**Create a backup** (a consistent copy made while the app is running; saved in a `backups` folder next to `docker-compose.yml`):
```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose exec backend node scripts/backup.js
docker compose cp backend:/app/data/backups/. .\backups
```
The backup files are named `vehicleflow-<date-time>.db`. Keep copies somewhere safe (another drive or cloud folder).

**Restore a backup** (this **replaces** the current database, so make a fresh backup first; replace the file name with your own):
```powershell
docker compose stop backend
docker compose run --rm --no-deps -v "${PWD}\backups:/restore:ro" backend sh -c "cp /restore/vehicleflow-2026-01-01-12-00-00.db /app/data/vehicleflow.db && rm -f /app/data/vehicleflow.db-wal /app/data/vehicleflow.db-shm"
docker compose start backend
```

### Moving from the old MySQL version
The old `mysql` container and its volume (`vehicleflow_mysql_data`) are no longer used and are **not deleted** by anything here. Their data is **not** copied into SQLite automatically. If the old stack is still running, stop it with `docker stop vehicleflow-mysql` (this does not delete the volume).

### Automated end-to-end check (optional)
With the containers running and the demo data loaded, this script walks through customer registration, vehicle, booking, Kanban assignment, repair, quality check, delivery, customer view, and the Scrum backlog / sprint planning / board / daily scrum / burndown / retrospective APIs. It only **adds** test records (marked `[smoke-test]`) and deletes nothing:
```powershell
docker compose exec backend node scripts/e2e-smoke.js
```

### Troubleshooting
- **"Cannot connect to the Docker daemon"** → start Docker Desktop and wait until it says it is running.
- **"port is already allocated"** → set `FRONTEND_PORT` or `BACKEND_PORT` in `.env`, then `docker compose up -d`.
- **`JWT_SECRET` error when running docker compose** → `.env` is missing or `JWT_SECRET` is empty. Follow the initial setup above.
- **Backend keeps restarting and its log says JWT_SECRET is "still the example value"** → paste a generated secret into `.env`, then `docker compose up -d`.
- **No demo users** → the database already had data or `SEED_DEMO_DATA=false`; the demo data is only added to a completely empty database.

---

## Run without Docker (optional)
Requirements: Node 20+ (a C++ build toolchain is only needed if no prebuilt `better-sqlite3` is available for your system).
```powershell
cd backend;  Copy-Item .env.example .env; npm install     # then put a generated JWT_SECRET in backend\.env
cd ..\frontend; Copy-Item .env.example .env; npm install
```

## Database setup and migration
- The database file is created and migrated automatically when the backend starts (`backend/data/vehicleflow.db`).
- **Demo data on an empty database:** `cd backend && npm run seed` (it never drops or deletes anything and does nothing if data already exists).
- **Migrations only:** `cd backend && npm run migrate` - safe to run many times.
- **Backup:** `cd backend && npm run backup`.

## Run
```bash
cd backend  && npm run dev     # API on http://localhost:5000  (check /api/health)
cd frontend && npm run dev     # app on http://localhost:5173
```
Demo logins: admin@vehicleflow.com / Admin@123 · ravi@vehicleflow.com / Mech@1234 · priya@example.com / Cust@1234

## Testing
```bash
cd backend  && npm test        # unit tests: stage rules, capacity, burndown, dates
cd frontend && npm run build   # production build
docker compose exec backend node scripts/e2e-smoke.js   # API workflow check against the running Docker app
```
Manual checklist: register a customer → add vehicle → book service → admin assigns mechanic on the board → mechanic Start repair / Mark completed → admin moves to Delivered → customer sees progress. Scrum: add story → create sprint → add stories (try exceeding capacity) → Start → move tasks → Daily Scrum → Complete sprint → Retrospective.

## Phase 1 – Customer module updates
- Vehicles: add, view, edit, delete, search; client + server validation.
- Dashboard: stats, vehicle cards, validated booking form, live status tracker (auto-refresh), cancel pending bookings.
- Bookings: status filters, five-stage tracker, activity timeline, service history tab.
- Profile: validated name/phone/password update with account summary.
- No backend/API, admin or Scrum changes were required.

## Phase 2 – Admin module updates
- Dashboard: live DB stats (customers, unassigned jobs, high-priority, cancelled, pipeline value) and most-booked services.
- Customers page (`/customers`, API `/api/admin/customers`): search, filter, sort, details (vehicles, service history), edit name/phone/address.
- Bookings page: search, status/priority/mechanic filters, sorting, assign mechanic, change status and priority, edit estimated/final cost and completion notes, customer details and activity history per booking; admins can create bookings.
- Kanban board and Scrum module are unchanged.

## Phase 5 – Admin Dashboard and Service Kanban Board
- Admin dashboard = 4 statistics (Total, To Do, In Progress, Done) + a three-column service Kanban board (`frontend/src/components/AdminKanban.jsx`).
- Columns group existing booking statuses (no schema change): To Do = pending/confirmed, In Progress = in_progress, Done = completed/delivered. Cancelled requests are hidden.
- API (admin only): `GET /api/service-board`, `GET /api/service-board/:id`, `PATCH /api/service-board/:id` (status, priority, mechanic_id, resolution_notes; resolution notes are stored in `mechanic_notes`).
- Drag and drop (native) plus a status dropdown on every card; FLIP animation; toast on success; failed moves are rolled back.
- Backend tests: `cd backend && npm test`.

## Phase 6 – Product Backlog and Service Request Details
- Admin **Product Backlog** (`/admin/backlog`, `pages/ProductBacklog.jsx`): every customer-reported problem, with All/High/Medium/Low filters, search (vehicle, customer, problem, ID) and sorting by priority or reported date.
- **Service Request Details** (`/admin/backlog/:id`, `pages/ServiceRequestDetails.jsx`): full details plus status, priority, mechanic and service notes; saved through `PATCH /api/service-board/:id`.
- New endpoint `GET /api/service-board/backlog` (admin only; includes cancelled requests, which are read-only). Same SQLite rows as the Kanban board and the customer's My Problems page, so status changes show everywhere.
- The earlier Scrum backlog pages are unchanged but no longer linked from the Product Backlog menu item.

## Phase 7 – Sprint Summary and final integration
- **Sprint Summary** (`/admin/sprint`, `pages/SprintSummary.jsx`): sprint name, goal and dates come from the existing `sprints` table (active sprint, else the most recent); total / completed / in-progress / to-do counts and the completion percentage are calculated from the real vehicle problem records (`GET /api/service-board/sprint-summary`). Cancelled requests are not counted.
- Docker Compose has exactly two services (`frontend`, `backend`); SQLite lives in the named volume `sqlite_data`. Copy `.env.example` to `.env` and set `JWT_SECRET` before `docker compose up -d --build`. No `.env`, database file or secret is included in this archive.

## Final UI correction
- Sidebars now show exactly: Customer = Dashboard, My Vehicles, Report a Problem, My Problems, Profile; Admin = Dashboard, Product Backlog, Customers, Vehicles, Sprint Summary (mechanics: Dashboard, My Jobs, Profile). The old Scrum/Bookings routes still exist but are no longer in the menu.
- Sidebar is about 180px wide on desktop; colours follow the reference palette (card #0B1C35, text #F5F8FF, muted #9BAFCB).
- Header bell shows the signed-in user's own notifications (`GET /api/notifications`, `POST /api/notifications/read`).
