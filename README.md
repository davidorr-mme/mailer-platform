# Mailer Platform

A full-stack email automation platform (MailerLite-style MVP). Manage contacts, build audience segments, design email campaigns, configure automated workflows, and analyse performance.

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

---

## Quick Start

### 1. Clone & install

```bash
cd mailer-platform

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Set up the database

Create a PostgreSQL database:

```bash
createdb mailer_platform
```

### 3. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/mailer_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-long-random-secret-here
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
FRONTEND_URL=http://localhost:5173
PORT=3001
```

> **Email sending:** For local development, use [Mailhog](https://github.com/mailhog/MailHog) (`SMTP_PORT=1025`) or leave SMTP unconfigured — the app will log emails to the console instead of sending them.

### 4. Run migrations & seed

```bash
cd backend
npm run migrate
npm run seed
```

The seed script creates:
- Admin user: `admin@example.com` / `password123`
- Pre-defined attribute definitions: `test_credit_score`, `test_credit_score_type`
- Pre-defined event definitions: `test_credit_score_created`, `test_credit_score_changed`, `test_last_email_opened`
- 50 synthetic contacts with randomised credit scores and event history
- Sample import files: `src/db/seeds/sample_contacts_import.xlsx` and `src/db/seeds/sample_events_import.xlsx`

### 5. Start the servers

**Backend** (runs on port 3001):

```bash
cd backend
npm run dev
```

**Frontend** (runs on port 5173):

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in with `admin@example.com` / `password123`.

---

## Architecture

```
mailer-platform/
├── backend/               # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/        # DB (Knex), Redis, env
│   │   ├── db/
│   │   │   ├── migrations/ # PostgreSQL schema (all tables)
│   │   │   └── seeds/      # Seed data + sample XLSX files
│   │   ├── middleware/    # JWT auth, error handler
│   │   ├── routes/        # REST API handlers
│   │   ├── services/      # Email, segment evaluator
│   │   ├── jobs/          # BullMQ workers (campaign send, automations)
│   │   └── index.ts       # Express app entry
│   └── knexfile.ts
└── frontend/              # React 18 + TypeScript + Vite
    └── src/
        ├── api/           # Axios API client modules
        ├── components/    # Shared UI components
        ├── pages/         # All page components
        └── types/         # Shared TypeScript interfaces
```

---

## API

All endpoints are prefixed `/api/`. Auth endpoints are public; all others require `Authorization: Bearer <token>`.

**Response envelope:**
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

**Paginated lists:**
```json
{ "success": true, "data": { "items": [], "total": 100, "page": 1, "pageSize": 25 } }
```

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Current user |

### Data Map
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/datamap/attributes | List / create attribute definitions |
| PUT/DELETE | /api/datamap/attributes/:id | Update / delete |
| GET/POST | /api/datamap/events | List / create event definitions |
| PUT/DELETE | /api/datamap/events/:id | Update / delete |

### Contacts (ingestion API)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/contacts/search?email= | Lookup contact by email |
| POST | /api/contacts | Upsert contact with attributes |
| PUT | /api/contacts/:id/attributes | Merge custom attributes |
| POST | /api/contacts/:id/events | Track a custom event |

### Segments
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/segments | List / create |
| GET/PUT/DELETE | /api/segments/:id | Get / update / delete |
| POST | /api/segments/estimate | Estimate audience count (unsaved) |
| POST | /api/segments/:id/estimate | Estimate for saved segment |
| POST | /api/segments/:id/duplicate | Duplicate segment |

### Campaigns
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/campaigns | List / create |
| GET/PUT/DELETE | /api/campaigns/:id | Get / update / delete |
| POST | /api/campaigns/:id/send | Queue immediate send |
| POST | /api/campaigns/:id/schedule | Schedule for later |
| POST | /api/campaigns/:id/duplicate | Duplicate |

### Automations
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/automations | List / create |
| GET/PUT/DELETE | /api/automations/:id | Get / update / delete |
| POST | /api/automations/:id/activate | Activate (with validation) |
| POST | /api/automations/:id/pause | Pause |
| POST | /api/automations/:id/duplicate | Duplicate |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports/campaigns | List with aggregate stats |
| GET | /api/reports/campaigns/:id | Full campaign report |
| GET | /api/reports/campaigns/:id/links | Link click breakdown |
| GET | /api/reports/campaigns/:id/recipients | Paginated recipient activity |

### Data Import
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/imports/upload | Parse file headers + preview |
| POST | /api/imports/execute | Run import (multipart) |
| GET | /api/imports/history | Import history |
| GET | /api/imports/history/:id/errors | Download error log |
| GET | /api/imports/sample/contacts | Download sample contacts XLSX |
| GET | /api/imports/sample/events | Download sample events XLSX |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboard/kpis?days=30 | Summary KPIs |
| GET | /api/dashboard/recent-campaigns | 5 most recent |
| GET | /api/dashboard/recent-automations | 5 most recent active |
| GET | /api/dashboard/performance-chart?days=30 | Daily open/click rates |

### Tracking (public, no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | /track/open/:sendId/:contactId | Email open pixel (1×1 GIF) |
| GET | /track/click/:sendId/:contactId/:hash | Click redirect |
| GET | /unsubscribe/:contactId/:token | One-click unsubscribe |

---

## Testing the Import Flow

Sample files are generated by the seed script:

1. Go to **Data Import** in the UI
2. Select **Contact & Attributes Import**
3. Upload `backend/src/db/seeds/sample_contacts_import.xlsx`
4. Map columns: `email → email`, `test_credit_score → test_credit_score`, `test_credit_score_type → test_credit_score_type`
5. Run import — should show ~10 contacts created, ~10 updated

For events:
1. Select **Events Import**
2. Upload `backend/src/db/seeds/sample_events_import.xlsx`
3. Map: `email → email`, `event_name → event_name`, `occurred_at → occurred_at`, `metadata → metadata`
4. Run import

---

## Testing the Segment Builder

With 50 seeded contacts, try these segments:

- **High credit score:** `test_credit_score` → `greater_than` → `800`
- **Equifax contacts:** `test_credit_score_type` → `equals` → `Equifax`
- **Had score change:** event `test_credit_score_changed` → `has_occurred`
- **Engaged + high score (AND):** Group 1: `test_credit_score > 700` AND event `test_last_email_opened has_occurred`

---

## Docker (optional)

To run PostgreSQL and Redis locally with Docker:

```bash
docker run -d --name mailer-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=mailer_platform \
  -p 5432:5432 postgres:16

docker run -d --name mailer-redis \
  -p 6379:6379 redis:7
```

---

## Out of Scope (v1)

- Multi-user workspaces / team permissions
- Native CRM integrations (Salesforce, HubSpot)
- SMS or push notification channels
- Landing page / form builder
- Multi-language support
