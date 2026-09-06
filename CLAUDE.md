# Lab Inventory — CLAUDE.md

## Stack
- **Backend**: FastAPI + SQLAlchemy ORM + PostgreSQL (Pydantic v2, python-jose JWT, bcrypt, google-auth)
- **Frontend**: React 19 + Vite + TailwindCSS + TanStack Query + React Router v6 + Recharts + Sonner + Framer Motion
- **Auth**: Google OAuth (`@kmitl.ac.th` only) + email/password; JWT HS256, 24h expiry
- **Dev**: `docker compose up -d` (postgres:16 + backend on :8000); frontend `npm run dev` (:5173)
- **Deploy**: Render (backend Dockerfile, inject env vars); Vercel (frontend)

---

# BACKEND

## Env vars
```
DATABASE_URL=postgresql://invent:invent@localhost:5432/invent
SECRET_KEY=<random>
GOOGLE_CLIENT_ID=<from GCP>
ADMIN_EMAILS=email1@kmitl.ac.th,email2@kmitl.ac.th
CORS_ORIGINS=http://localhost:5173,http://localhost:4173
```

## Architecture (strict layers)
```
api/v1/*.py   → receive, call service, return. NO logic, NO DB queries
services/*.py → all business rules, validation, orchestration
models/*.py   → SQLAlchemy ORM only, no logic
schemas/*.py  → Pydantic shapes, no DB imports
core/         → auth, JWT, security helpers
```
**Never**: raw SQL, logic in api/, DB queries in api/, hard delete anything.

## Code rules
- Type hints everywhere; snake_case vars/funcs; PascalCase classes
- Max ~30 lines/function; one responsibility per function
- HTTP codes: 201 create, 204 delete, 200 all others, 422 auto by Pydantic
- Errors always: `{"detail": "message"}`
- Soft delete only: `is_active=False` (items, users, locations); borrow_records never deleted

## Domain names (use exactly)
`Item` · `BorrowRecord` · `User` · `Location` · `BorrowStatus` · `UserRoleEnum`

## API — base `/api/`
| Prefix | File | Auth guard |
|--------|------|-----------|
| `/auth` | api/auth.py | public |
| `/items` | api/items.py | `get_current_user`; write/delete → `require_admin` |
| `/locations` | api/locations.py | `get_current_user`; write/delete → `require_admin` |
| `/borrow`, `/return`, `/transactions` | api/borrow.py | `get_current_user` |
| `/users` | api/users.py | `PATCH /users/me` → `get_current_user`; others → `require_admin` |
| `/stats/*` | api/stats.py | `get_current_user` |

REST pattern: `GET /items` (list), `POST /items` (create 201), `GET /items/{id}`, `PATCH /items/{id}`, `DELETE /items/{id}` (soft, 204).
Pagination: `?skip=0&limit=100`.

## DB schema (SQLAlchemy ORM, no Alembic — `create_all` on startup)

### users
`id PK | email UNIQUE idx | password NULL(OAuth) | auth_provider("email"|"google") | full_name NULL | department NULL | role Enum(admin,user) default user | is_active Bool default True | created_at | updated_at`
- `department` auto-set from email: `xxxx00xx`→Mechatronics, `xxxx10xx`→ComputerEng, `xxxx20xx`→EEE
- `user.borrow_records` → BorrowRecord[]

### items
`id PK | name idx | description NULL | category NULL idx | total_quantity | available_quantity | low_stock_threshold default 1 | location_id FK NULL | is_active default True | created_at | updated_at`
- `available_quantity` = shelf stock (decrements on borrow, increments on return)
- low stock alert when `available_quantity <= low_stock_threshold`

### locations
`id PK | name UNIQUE | description NULL | is_active default True | created_at | updated_at`

### borrow_records
`id PK | user_id FK idx | item_id FK idx | quantity default 1 | status Enum(borrowed,returned) idx default borrowed | borrowed_at | due_date NULL | returned_at NULL | note NULL`
- `due_date` is set by frontend on borrow; used for overdue detection

### Enums
```python
UserRoleEnum: admin | user        # app/models/user.py
BorrowStatus: borrowed | returned  # app/models/borrow.py
```

## Key service logic

### auth_service
- `authenticate(db, body)` → verify email/password, return JWT + UserOut
- `authenticate_google(db, credential)` → verify Google token (domain @kmitl.ac.th), auto-create user, auto-promote to admin if email in ADMIN_EMAILS
- `create_user` hashes password with bcrypt, auto-detects department
- `update_user` checks email uniqueness, re-hashes password if changed
- `soft_delete_user` → `is_active=False`

### borrow_service
- `borrow_item` → 404 if item not found/inactive, 409 if `available_quantity < qty`, decrement qty, create BorrowRecord (stores `due_date`)
- `return_item` → 409 if already returned, 403 if non-admin returning other's borrow; restock qty, set `returned_at`
- `list_transactions` → non-admins see only own records; admins see all, filterable by user_id/item_id/status

### item_service
- `create_item` → `available_quantity = total_quantity` at creation
- `update_item` → if `total_quantity` changes, shift `available_quantity` by same delta; 400 if result < 0

### stats_service
- `summary(db)` → total_items, total_users, active_borrows, low_stock_items counts
- `item_usage(db, limit)` → top N items by borrow count
- `stock_movement(db, days)` → day-by-day borrow vs return quantities
- `low_stock(db)` → items where `available_quantity <= low_stock_threshold`
- `leaderboard(db, limit)` → top users ranked by borrow count with department info
- `recommendations(db, limit)` → items frequently borrowed together (category-based)

## Schema changes (no Alembic)
- Add column → update model, restart app (new tables auto-created; existing tables need manual `ALTER TABLE`)
- Breaking change → `docker compose down -v && docker compose up -d` (destroys data)
- Render prod → use Render web shell or psql to `ALTER TABLE`

## Security
- JWT: HS256, `SECRET_KEY` from env, 24h expiry; payload: `{sub: user_id, role, exp}`
- `decode_token` in `core/security.py`; `get_current_user` in `api/deps.py` resolves JWT→User row
- `require_admin` guard checks `role == admin`
- Google token verified via `google.oauth2.id_token.verify_oauth2_token`; issuer + domain checked

## Common commands
```bash
# Backend dev
docker compose up -d
docker compose logs backend -f

# DB inspect
docker compose exec postgres psql -U invent -d invent
\dt | \d+ items | SELECT count(*) FROM items;

# Reset DB (destroys all data)
docker compose down -v && docker compose up -d

# Seed manually
docker compose exec backend python -c "from app.seed import seed_if_empty; seed_if_empty()"
```

---

# FRONTEND

## Env vars
```
VITE_API_URL=http://localhost:8000/api
VITE_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>
```

## Project structure
```
src/
  lib/
    apiClient.js     — fetch wrapper; reads token from localStorage("lab_token"); throws on !res.ok
    utils.js         — cn(), formatDate(), formatRelative(), getStatusColor(), getConditionColor(), truncate()
  hooks/
    useAuth.jsx      — AuthContext; stores token+user in localStorage("lab_token","lab_currentUser")
  services/
    authService.js   — googleLogin(), emailLogin()
    itemService.js   — listItems(), getItem(), createItem(), updateItem(), deleteItem()
    borrowService.js — borrow(), returnItem(), listTransactions()
    locationService.js — listLocations(), createLocation(), updateLocation(), deleteLocation()
    statsService.js  — getSummary(), getItemUsage(), getStockMovement(), getLowStock(),
                       getLeaderboard(), getRecommendations()
    userService.js   — listUsers(), getUser(), updateMe(), createUser(), updateUser(), deleteUser()
  pages/
    Login, Dashboard, Inventory, ItemDetail, BorrowReturn, QrScanner,
    Locations, Analytics, Maintenance, Recommendations, Leaderboard,
    Reports, Admin, Settings
  components/
    Sidebar, Header, CommandPalette, PageTransition
    ui/index.jsx — Skeleton, EmptyState, ErrorState, ConfirmDialog, StatCard, Badge, TableSkeleton
  layouts/
    AuthLayout, DashboardLayout
```

## Data flow rules
- `useAuth` → provides `currentUser`, `login(credential)`, `emailLogin(email,pw)`, `logout`, `isAuthenticated`
- All API calls via `apiClient.{get,post,patch,delete}(endpoint)` → auto-injects Bearer token
- TanStack Query for server state: `staleTime: 5min, retry: 1`
- Protected routes check `isAuthenticated`; redirect to `/login` if false
- Admin routes check `currentUser.role === "admin"`; redirect to `/` if not admin

## Key field names (API → Frontend)
| API field | Frontend usage |
|-----------|---------------|
| `full_name` | `currentUser.full_name` (NOT `.name`) |
| `available_quantity` | Used for stock display and borrow form max |
| `due_date` | Sent on borrow, shown in My Items / Overdue tabs |
| `borrow_count` | Leaderboard ranking metric |

## localStorage keys
| Key | Content |
|-----|---------|
| `lab_token` | JWT access token |
| `lab_currentUser` | JSON of UserOut object |
| `lab_notifications` | User's notification preferences (no backend) |
| `lab_theme` | Selected theme ID (no backend) |
| `lab_fontsize` | Selected font size (no backend) |

## Routes
`/ → Dashboard | /inventory → Inventory | /inventory/:id → ItemDetail | /borrow → BorrowReturn | /qr-scanner | /locations | /analytics | /maintenance | /recommendations | /leaderboard | /reports | /admin (admin only) | /settings`

## What pages use (page → real API endpoints)
| Page | Endpoints used | Data source |
|------|---------------|-------------|
| Dashboard | GET /stats/summary, /stats/low-stock, /stats/stock-movement, /transactions | Real API |
| Inventory | GET /items, POST /items, PATCH /items/{id}, DELETE /items/{id} | Real API |
| ItemDetail | GET /items/{id}, /transactions?item_id= | Real API |
| BorrowReturn | POST /borrow, POST /return, GET /transactions, GET /items | Real API |
| Locations | GET /locations, POST /locations, PATCH, DELETE | Real API |
| Analytics | GET /stats/summary, /stats/item-usage, /stats/stock-movement, /stats/low-stock | Real API |
| Admin | GET /users, POST /users, PATCH /users/{id}, DELETE /users/{id} | Real API |
| QrScanner | GET /items/{id} | Real API |
| **Leaderboard** | **GET /stats/leaderboard** | **Real API** |
| **Recommendations** | **GET /stats/recommendations** | **Real API** |
| **Settings → Profile** | **PATCH /users/me** | **Real API** |
| **Settings → Security** | **PATCH /users/{id}** (password) | **Real API** |
| Settings → Notifications | — | localStorage only |
| Settings → Appearance | — | localStorage only |

## Dev commands
```bash
# Start frontend dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Seed data
- `app/seed.py` + `equipment.csv` (224 items); called in `lifespan` after `create_all`; idempotent (`count > 0` guard)
- CSV: `Name→name, Description→description, Total Quantity→total_quantity, Quantity Available→available_quantity`

## Image handling
- Items from API have no image field — frontend synthesizes: `https://picsum.photos/seed/${item.id}/400/300`
- Always use fallback: `item.image || \`https://picsum.photos/seed/${item.id}/80/80\``
- User avatars: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=7C8D7D&color=fff`
