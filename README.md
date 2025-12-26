# Pellets Hub - Orders Management System

Production-grade orders hub for a wood pellets ecommerce site serving Germany (DE) and Austria (AT).

## Features

- **Customer Account (LK)**
  - Login / Register / Password reset
  - Order history with status tracking
  - Address management
  - Invoice downloads

- **Admin Panel**
  - Dashboard with metrics (today, yesterday, 7 days, all-time)
  - Orders management (normal vs preorders, filters)
  - Status management with automatic transitions
  - Email intent system (weekend hello, confirmations, etc.)
  - Payment tracking

- **Order System**
  - Order numbers starting at 300-001
  - Country-specific VAT (DE: 7% MwSt., AT: 20% USt.)
  - Multiple payment methods (Vorkasse, Lastschrift, PayPal, Klarna)
  - Automatic status progression with randomized delays
  - Email outbox for async sending

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Email**: Resend (placeholder integration)

## Setup

### 1. Environment Variables

Copy the contents from `ENV_SETUP.md` to create `.env.local`:

```bash
# See ENV_SETUP.md for all required variables
```

### 2. Database Setup

Run the migration in Supabase SQL Editor:

```bash
# Copy contents of supabase/migrations/001_initial_schema.sql
# and run in Supabase Dashboard > SQL Editor
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── account/           # Customer account pages
│   │   ├── login/
│   │   ├── register/
│   │   └── orders/
│   ├── admin/             # Admin panel pages
│   │   ├── login/
│   │   └── orders/
│   └── api/               # API routes
│       ├── auth/
│       └── cron/
├── components/            # React components
│   ├── layout/
│   ├── orders/
│   └── ui/
├── config/               # App configuration
├── lib/                  # Utilities
│   ├── supabase/
│   └── utils.ts
├── repositories/         # Data layer (Repository pattern)
│   ├── interfaces.ts
│   └── supabase/
├── services/             # Business logic
│   ├── order-service.ts
│   ├── status-scheduler.ts
│   ├── metrics-service.ts
│   └── auth-service.ts
└── types/                # TypeScript types
```

## Key Concepts

### Repository Pattern

All data access is abstracted behind interfaces in `src/repositories/interfaces.ts`. 
This allows swapping Supabase for another storage solution without changing business logic.

### Status Automation

Orders automatically progress through statuses:
1. `received` → `confirmed` (1-3 hours)
2. `confirmed` → `planning_delivery` (22-48 hours)
3. `planning_delivery` → `shipped` (15-24 hours)
4. `shipped` → `in_transit` (1-4 hours)
5. `in_transit` → `delivered` (manual or max 7 days)

Delays are randomized but deterministic per order (seeded by order ID).

### Email Outbox

Emails are queued in `email_outbox` table, not sent directly. A separate worker (Resend integration) will consume the queue.

Types:
- `weekend_hello` - Orders created on weekends
- `confirmation` - Order confirmation
- `payment_instructions` - Payment details
- `shipped`, `in_transit`, `delivered` - Status updates
- `cancelled` - Cancellation notice
- `review_request` - Post-delivery review request

### Country Configuration

VAT and terminology differ by country:
- **Germany (DE)**: 7% MwSt. (for heating fuel)
- **Austria (AT)**: 20% USt.

Totals are stored as snapshots on order creation - changing config doesn't affect historical orders.

## Default Admin Login

```
Email: admin@pelletor.at
Password: admin123
```

⚠️ **Change this immediately in production!**

## Cron Jobs

Status transitions and weekend hello emails are processed by:

```
GET /api/cron/process-orders
```

Runs every 15 minutes (configured in `vercel.json`).

## TODO / Phase 2

- [ ] Supabase Auth integration (replace simple auth)
- [ ] Resend email sending
- [ ] Invoice PDF generation
- [ ] Real product catalog
- [ ] Order creation flow from shop
- [ ] Payment integration
