# MediCap — Hospital Patient & Room Capacity Management System

A full-stack app that manages hospital room/bed capacity with parking-garage-style
logic: admitting a patient fills a bed, discharging frees one, and rooms auto-flip to
**Full** when all beds are occupied (blocking further admissions until a discharge).

**Stack:** Node.js (Express) · MySQL/MariaDB · HTML + Tailwind (CDN) + vanilla JS (Fetch API).

## 🔴 Live demo (GitHub Pages)

**https://magicman-jpeg.github.io/DATABASE-Hospital/**

The live demo is a **multi-page site** running on **in-browser mock data** (no backend/database)
so it can be hosted on GitHub Pages. All actions work; data persists across pages via
`sessionStorage` and resets with the "Reset Demo" button. The mock replicates the real
backend's capacity logic (auto-fill, Full status, discharge reopening).

**Demo pages:**
- `index.html` — landing page with live mini-stats
- `dashboard.html` — the capacity grid (admit / discharge / filter)
- `patients.html` — searchable patient table
- `admissions.html` — chronological admit/discharge timeline

**Demo structure** (`docs/`):
```
docs/
├── index.html  dashboard.html  patients.html  admissions.html
├── css/style.css          # shared styles
└── js/
    ├── store.js           # shared in-browser mock store (mirrors schema + backend logic)
    ├── ui.js              # shared nav bar, aurora, toast, status styling
    ├── dashboard.js  patients.js  admissions.js
```

> The real, persistent app lives in the repo root (`server.js`, `schema.sql`, `public/`).

---

## Features

- **Live capacity grid** — one card per room with an occupancy gauge (`3 / 5 beds`, `60% full`).
- **Color-coded status** — 🟢 Available · 🟡 Near Full (1 bed left) · 🔴 Full (admit disabled) · ⚙️ Maintenance.
- **Admit workflow** — register a patient + assign an available room (full rooms filtered out). Occupancy auto-increments; room flips to **Full** at capacity.
- **Discharge workflow** — one click frees the bed, sets `discharge_date`, and reopens the room.
- **Filters** — by department, room type, and status.
- **Race-safe** — admissions run in a transaction with a `SELECT ... FOR UPDATE` row lock so the last bed can't be double-booked.
- **Occupancy integrity** — `rooms.current_occupancy` and `status` are maintained by **MySQL triggers**, so they can't drift out of sync.

---

## Setup

### 1. Database
Requires MySQL 8+ or MariaDB 10.5+ (the schema uses `CHECK` constraints and triggers).

```bash
mysql -u root -p < schema.sql
```
This creates the `hospital_capacity` database, tables, triggers, a `v_room_capacity` view, and sample data.

### 2. Backend
```bash
cp .env.example .env      # then edit DB credentials
npm install
npm start                 # or: npm run dev  (auto-reload)
```
Open http://localhost:3000

---

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET   | `/api/health` | DB connectivity check |
| GET   | `/api/departments` | List departments (filter dropdown) |
| GET   | `/api/rooms` | Rooms + capacity. Query: `?department=&type=&status=` |
| GET   | `/api/admissions?active=true` | Active admissions with patient + room info |
| POST  | `/api/admissions` | Admit: `{ first_name, last_name, contact_number, room_id }` |
| PATCH | `/api/admissions/:id/discharge` | Discharge a patient |
| PATCH | `/api/rooms/:id/status` | Set `Available` / `Maintenance` |

---

## How the auto-capacity logic works

1. **Admit** → `INSERT` into `admissions (status='Active')`.
   An `AFTER INSERT` trigger does `current_occupancy + 1` and sets `status='Full'` if the room is now at `max_capacity`.
2. **Discharge** → `UPDATE admissions SET status='Discharged'`.
   An `AFTER UPDATE` trigger does `current_occupancy - 1` and reopens the room (`'Available'`) unless it's in `Maintenance`.

Because occupancy is derived in the database, the API stays simple and the counts
are always consistent even under concurrent requests.

---

## Database schema (summary)

- **departments** — `department_id`, `department_name`
- **rooms** — `room_id`, `room_number`, `department_id` (FK), `room_type` (ENUM), `max_capacity`, `current_occupancy`, `status` (ENUM)
- **patients** — `patient_id`, `first_name`, `last_name`, `contact_number`, `admission_status` (ENUM)
- **admissions** — `admission_id`, `patient_id` (FK), `room_id` (FK), `admission_date`, `discharge_date`, `status` (ENUM)

A partial unique index (`patient_id`, `status`) prevents a patient from holding two
active admissions at once.

---

## Notes

- The frontend talks to the API via the Fetch API and auto-refreshes every 15 s so the grid stays "live".
- No analytics, cookies, or third-party trackers — only Tailwind, Google Fonts, and Remixicon via CDN.
- This is sample/demo software. For real clinical use you'd add authentication, audit logging, and data-privacy controls appropriate to your jurisdiction.
