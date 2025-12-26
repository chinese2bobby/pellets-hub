# 🧠 MASTERMIND PROJECT SETUP - PELLETS HUB

## Краткое описание

Это **НЕ Heizline**. Это новый проект **Pelletor** - отдельный бренд для продажи древесных пеллетов в Австрии и Германии.

**Два репозитория:**
1. `pellets-de-1` - Фронтенд сайт (HTML/CSS/JS) с формами заказа
2. `pellets-hub` - Next.js админка + клиентский ЛК (личный кабинет)

---

## 🚀 Как запустить

### Терминал 1 - Админка/ЛК (Next.js)
```bash
cd /Users/kevinhall/Documents/pellets-hub
npm run dev
# Работает на http://localhost:3001
```

### Терминал 2 - Фронтенд сайт
```bash
cd /Users/kevinhall/Documents/pellets-de-1
npx serve -p 8080
# Работает на http://localhost:8080
```

---

## 🔐 Тестовые аккаунты

### Admin Panel
```
URL:      http://localhost:3001/admin/login
Email:    mastermind@pelletor.at
Password: Mastermind2025!
```

### Customer Account (ЛК)
```
URL:      http://localhost:3001/account/login
Email:    kevin@mastermind.io
Password: Kevin2025!
```

---

## 📍 Все URL

| Страница | URL |
|----------|-----|
| **Админ логин** | http://localhost:3001/admin/login |
| **Админ дашборд** | http://localhost:3001/admin |
| **Админ заказы** | http://localhost:3001/admin/orders |
| **Админ детали заказа** | http://localhost:3001/admin/orders/300-001 |
| **ЛК логин** | http://localhost:3001/account/login |
| **ЛК дашборд** | http://localhost:3001/account |
| **ЛК заказы** | http://localhost:3001/account/orders |
| **Форма заказа** | http://localhost:8080/bestellung.html |
| **Форма предзаказа** | http://localhost:8080/vorbestellung.html |
| **Главная сайта** | http://localhost:8080/index.html |

---

## 📁 Структура проекта pellets-hub

```
pellets-hub/
├── src/
│   ├── app/
│   │   ├── admin/                    # Админка
│   │   │   ├── login/page.tsx        # Логин админа
│   │   │   ├── logout/page.tsx       # Выход
│   │   │   ├── page.tsx              # Дашборд с метриками
│   │   │   └── orders/
│   │   │       ├── page.tsx          # Список заказов
│   │   │       └── [orderNo]/page.tsx # Детали заказа
│   │   │
│   │   ├── account/                  # Клиентский ЛК
│   │   │   ├── login/page.tsx        # Логин клиента
│   │   │   ├── logout/page.tsx       # Выход
│   │   │   ├── page.tsx              # Дашборд клиента
│   │   │   └── orders/page.tsx       # Заказы клиента
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts    # POST логин
│   │       │   ├── logout/route.ts   # POST выход
│   │       │   └── session/route.ts  # GET сессия
│   │       │
│   │       └── orders/
│   │           ├── route.ts          # GET все заказы
│   │           ├── submit/route.ts   # POST новый заказ (от форм сайта)
│   │           ├── action/route.ts   # POST действия (send email, cancel)
│   │           ├── my/route.ts       # GET заказы текущего пользователя
│   │           └── [orderNo]/route.ts # GET один заказ
│   │
│   ├── components/
│   │   ├── ui/                       # Базовые UI компоненты
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   └── dialog.tsx
│   │   │
│   │   ├── layout/
│   │   │   └── header.tsx            # Шапка с навигацией
│   │   │
│   │   └── orders/
│   │       ├── order-card.tsx        # Карточка заказа
│   │       └── status-badge.tsx      # Бейдж статуса
│   │
│   ├── lib/
│   │   ├── auth.ts                   # Авторизация (TEST_ACCOUNTS здесь!)
│   │   ├── email.ts                  # Resend интеграция
│   │   ├── memory-store.ts           # In-memory хранилище (тестовые данные!)
│   │   └── utils.ts                  # Утилиты (formatCurrency, etc)
│   │
│   ├── config/
│   │   └── index.ts                  # Конфиг (COMPANY, PRODUCTS, STATUS_CONFIG)
│   │
│   └── types/
│       └── index.ts                  # TypeScript типы (Order, User, etc)
│
├── .env.local                        # Секреты (Supabase, Resend)
├── ENV_SETUP.md                      # Инструкция по env
└── package.json
```

---

## 📁 Структура проекта pellets-de-1 (Сайт)

```
pellets-de-1/
├── index.html              # Главная страница
├── bestellung.html         # Форма обычного заказа
├── vorbestellung.html      # Форма предзаказа (Frühbucher)
├── produkte.html           # Страница продуктов
├── qualitaet.html          # Качество
├── kontakt.html            # Контакты
├── faq.html                # FAQ
├── lieferung-zahlung.html  # Доставка и оплата
├── bewertungen.html        # Отзывы
├── impressum.html          # Импрессум
├── datenschutz.html        # Политика конфиденциальности
├── agb.html                # Условия использования
├── widerruf.html           # Отказ от ответственности
├── danke.html              # Страница благодарности (после заказа)
├── danke-vorbestellung.html # Благодарность после предзаказа
├── fruehbucher.html        # Лендинг Frühbucher
│
├── styles.css              # Главные стили
├── script.js               # Главный JS
│
├── js/
│   ├── checkout-config.js  # Конфиг чекаута
│   └── checkout-ui.js      # UI чекаута
│
├── assets/                 # Картинки, логотипы
│   ├── logo.png
│   ├── hero-bg.jpg
│   └── ...
│
├── checkout/               # Страницы чекаута по продуктам
│   ├── eco-palette.html
│   ├── premium-lose.html
│   └── premium-palette.html
│
└── functions/              # Supabase Edge Functions (старые, не используются)
    └── ...
```

---

## 🗄️ Данные (In-Memory Store)

Сейчас данные хранятся в памяти (`src/lib/memory-store.ts`). При перезапуске сервера данные сбрасываются, но автоматически создаются тестовые заказы.

### Тестовые заказы (создаются автоматически):

| Order # | Customer | Country | Type | Status | Email |
|---------|----------|---------|------|--------|-------|
| 300-001 | Kevin Hall | AT | normal | confirmed | kevin@mastermind.io |
| 300-002 | Kevin Hall | AT | preorder | planning | kevin@mastermind.io |
| 300-003 | Max Mustermann | DE | normal | received | test@example.de |

---

## 🔧 API Endpoints

### Auth
- `POST /api/auth/login` - Логин (body: `{email, password}`)
- `POST /api/auth/logout` - Выход
- `GET /api/auth/session` - Проверка сессии

### Orders
- `GET /api/orders` - Все заказы (для админа)
- `GET /api/orders/my` - Заказы текущего пользователя
- `GET /api/orders/[orderNo]` - Один заказ по номеру
- `POST /api/orders/submit` - Создать заказ (от форм сайта)
- `POST /api/orders/action` - Действия над заказами

### Actions (POST /api/orders/action)
```json
{
  "action": "send_hello" | "send_confirmation" | "cancel",
  "orderIds": ["uuid1", "uuid2"]
}
```

---

## 📧 Email (Resend)

Интеграция через Resend API в `src/lib/email.ts`.

**Типы писем:**
- `weekend_hello` - Приветствие (заказ в выходные)
- `confirmation` - Подтверждение заказа
- `payment_instructions` - Инструкции по оплате
- `cancelled` - Отмена заказа

**Для работы нужен верифицированный домен в Resend или использовать:**
```
RESEND_FROM_EMAIL=onboarding@resend.dev
```

---

## 🎨 Статусы заказов

| Status | Label (EN) | Color |
|--------|------------|-------|
| received | Received | blue |
| confirmed | Confirmed | indigo |
| planning_delivery | Planning | yellow |
| shipped | Shipped | purple |
| in_transit | In Transit | orange |
| delivered | Delivered | green |
| cancelled | Cancelled | red |

---

## 💳 Методы оплаты

| Code | Label |
|------|-------|
| vorkasse | Bank Transfer |
| lastschrift | Direct Debit (SEPA) |
| paypal | PayPal |
| klarna | Klarna |

---

## 🌍 Страны

| Code | Name | VAT | VAT Label |
|------|------|-----|-----------|
| AT | Austria | 20% | USt. |
| DE | Germany | 7% | MwSt. |

---

## 📦 Продукты

| SKU | Name | Unit |
|-----|------|------|
| PREM-LOSE | Premium Pellets Loose | kg (silo) |
| PREM-SACK | Premium Pellets Bagged | palette |
| ECO-PAL | Eco Pellets Pallet | palette |

---

## 🔑 Environment Variables (.env.local)

```bash
# Supabase (пока не используется активно)
NEXT_PUBLIC_SUPABASE_URL=https://srtsuzvjjcrliuaftvce.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Resend
RESEND_API_KEY=re_FExbTTsy_6uscdbwDaiNzgkAFi76SXNMr
RESEND_FROM_EMAIL=bestellung@pelletor.at
RESEND_FROM_NAME=Pelletor

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## ✅ Что работает

- [x] Админ логин/логаут
- [x] Клиент логин/логаут
- [x] Админ дашборд с метриками
- [x] Список заказов (админ)
- [x] Детали заказа (админ)
- [x] Массовый выбор заказов
- [x] Действия: Send Hello, Send Confirmation, Cancel
- [x] Диалоги подтверждения
- [x] Клиентский ЛК
- [x] Заказы клиента
- [x] Формы заказа на сайте → отправка в API
- [x] Resend интеграция (email templates)
- [x] Тестовые данные при старте

## ⏳ TODO

- [ ] Supabase persistence (сейчас in-memory)
- [ ] Верификация домена в Resend
- [ ] Детали заказа в клиентском ЛК
- [ ] Invoice PDF генерация
- [ ] Klarna интеграция

---

## 🚨 Частые проблемы

### "Заказы не отображаются"
Сервер перезапустился → данные сбросились. Отправь тестовый заказ через форму или перезапусти сервер (тестовые данные создадутся автоматически).

### "Email не отправляется"
1. Проверь `RESEND_API_KEY` в `.env.local`
2. Домен должен быть верифицирован или используй `onboarding@resend.dev`

### "404 на странице детали заказа"
Проверь что заказ существует. Номер должен быть в формате `300-001`.

---

## 📞 Контакты проекта

- Компания: **Pelletor GmbH** (placeholder)
- Домен: **pelletor.at** (placeholder)
- Email: bestellung@pelletor.at

---

*Последнее обновление: 25.12.2024*

