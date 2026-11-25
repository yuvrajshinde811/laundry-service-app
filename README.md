# 🧺 FreshWave Laundry — Full-Stack Laundry Service & Delivery Platform

A clean, professional, responsive, full-stack **Laundry Service Booking & Delivery Web Application** built for small-to-medium laundry and dry cleaning businesses.

The system empowers customers to book doorstep laundry pickups with instant **WhatsApp notifications**, enables live **multi-stage order tracking**, and gives administrators a comprehensive **control panel** with analytics, status updates, invoice generation, and direct customer WhatsApp messaging.

---

## 🌟 Key Features

### 👤 Customer Experience
* **Professional Small-Business Landing Page**: Clean, trustworthy design showcasing services, pricing tables, live cost estimator, process breakdown, and direct WhatsApp support.
* **5-Step Booking Wizard**:
  1. **Customer & Contact Details**: Full name, 10-digit mobile number, WhatsApp number (with "Same as phone" toggle), address, area, city, and 6-digit pincode.
  2. **Laundry Items Selection**: Intuitive steppers (`+` / `-`) for Shirts, T-Shirts, Pants, Jeans, Sarees, Bedsheets, Blankets, Suits, Kurtas, etc. + Special handling notes.
  3. **Service Customization & Price Engine**: Choose from *Washing*, *Washing + Steam Ironing*, *Dry Cleaning*, or *Steam Ironing* globally or per garment with live automated totals, express delivery fees, and discount coupons (`FRESH10`, `WELCOME50`).
  4. **Pickup & Delivery Scheduler**: Select pickup dates, 2-hour pickup windows, and standard (48h) or express (24h) delivery preference.
  5. **Order Review & Confirmation**: Full summary inspection and instant confirmation.
* **Unique Business Order ID**: Automated generation of sequential/timestamped IDs (e.g., `LAUNDRY-20260821-00125`).
* **Real-Time Visual Order Tracking**: Track order status by Order ID and Mobile Number across 8 lifecycle stages:
  $$\text{Booking Confirmed} \rightarrow \text{Pickup Scheduled} \rightarrow \text{Picked Up} \rightarrow \text{Washing} \rightarrow \text{Ironing} \rightarrow \text{Ready for Delivery} \rightarrow \text{Out for Delivery} \rightarrow \text{Delivered}$$
* **Printable Receipts & Job Sheets**: Single-click printable invoice and customer receipt.

---

### 💬 WhatsApp Integration
* **Customer Confirmation Alert**: Instant WhatsApp message detailing Order ID, garments, pickup date/slot, total amount, and live tracking link.
* **Admin Order Alert (`8080082714`)**: Immediate WhatsApp notification to the laundry store administrator containing complete customer contact details, address, garment itemization, and special care instructions.
* **Status Update Broadcasts**: Automatic WhatsApp notification to the customer when their order progresses (e.g. "Clothes Picked Up", "Washing Completed", "Out for Delivery").
* **Official Meta Cloud API & Fallback Simulator**:
  * Seamlessly connects to the **Meta WhatsApp Business Cloud API** when credentials are configured in `.env`.
  * **Zero-Setup Fallback Simulator**: If API credentials are not yet supplied, orders succeed without interruption, detailed payloads are logged to the console, and one-click `wa.me` chat links are generated for instant real-device messaging!

---

### 🛡️ Admin Management Dashboard
* **Secure JWT Authentication**: Role-based access control with password hashing via `bcryptjs`.
* **Real-Time KPI Metric Cards**:
  * Today's Orders
  * Pending / Confirmed Bookings
  * Garments in Washing / Processing
  * Ready & Out for Delivery
  * Completed Orders
  * Today's Revenue & Total Lifetime Revenue
* **Comprehensive Orders Table**: Search by ID, Customer Name, or Phone; filter by Status tabs; filter by Pickup Date.
* **Interactive Order Modal**: Full garment list inspection, customer address snapshot, and history timeline.
* **Status Management**: Change status with custom driver/processing notes and optional customer WhatsApp alert toggle.
* **1-Click WhatsApp Direct Chat**: Launch pre-filled WhatsApp conversation with the customer from the dashboard.
* **Invoice & Work Order Print**: Formatted for printing physical tags for pickup drivers and workshop staff.

---

### 🤖 AI-Powered Customer & Admin Assistants
* **Customer Floating AI Chatbot** (`client/js/chatbot.js`):
  * Floating chat widget across `index.html`, `booking.html`, and `tracking.html` with minimize, close, clear history, typing indicators, timestamps, and 8 suggested quick questions.
  * **Grounded Knowledge Base**: Answers strictly from real database/backend services, item prices, delivery charges, promo coupons (`FRESH10`, `WELCOME50`), working hours, and contact info — never invents prices or policies.
  * **Conversational Laundry Booking**: Collects customer details, garments, services, pickup date/slot, and delivery preference across turns, calculates backend totals, asks for explicit confirmation, and creates the booking through the existing `createOrderRecord` pipeline + WhatsApp notification workflow.
  * **AI Order Tracking**: Verifies Order ID + registered mobile number before explaining real-time order progress.
  * **Graceful Fallback**: When `OPENAI_API_KEY` is absent, `AI_ENABLED=false`, or the AI provider fails, displays a friendly fallback message with direct links to the regular booking form, order tracker, and WhatsApp (`8080082714`).
* **Admin AI Assistant & Business Insights** (`client/js/admin-ai.js` & `client/admin/dashboard.html`):
  * Protected by admin JWT (`verifyAdminToken`) — never accessible to customer sessions.
  * **Live Business Insights & Charts**: 7-day revenue trend bar chart, popular services doughnut chart, month-over-month revenue comparison, completion rate, top customers, delayed/attention-required orders, and operational bottlenecks.
  * **Operational AI Actions with Confirmation**: Can look up orders and propose status updates or cancellations, always requiring explicit admin confirmation (`Confirm Action` card) before modifying database records.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Custom Theme), JavaScript (ES6+), Bootstrap 5.3, Bootstrap Icons, Chart.js |
| **Backend** | Node.js, Express.js (REST API Architecture) |
| **Database** | MongoDB with Mongoose (Atlas / Local MongoDB) + Built-in In-Memory Fallback |
| **AI Engine** | Local **Ollama** (`llama3.2:3b` via `/api/chat`, 100% Free, No API Key Required) + Modular Adapters for Google Gemini & OpenAI |
| **Security** | Helmet, CORS, Express Rate Limit, Express Validator, JWT, bcryptjs |
| **Messaging** | Meta WhatsApp Business Cloud API + `wa.me` Click-to-Chat Service |

---

## 📁 Project Structure

```text
laundry-service-app/
├── client/
│   ├── index.html               # Customer Landing & Services Page
│   ├── booking.html             # 5-Step Customer Booking Wizard
│   ├── tracking.html            # Public Order Tracking Portal
│   ├── admin/
│   │   ├── login.html           # Admin Authentication Page
│   │   ├── dashboard.html       # Full Admin Control Panel
│   │   └── order.html           # Printable Invoice / Job Sheet
│   ├── css/
│   │   └── style.css            # Responsive Theme Stylesheet
│   └── js/
│       ├── main.js              # Landing page & dynamic service loader
│       ├── booking.js           # Wizard logic, calculations, API submission
│       ├── tracking.js          # Order tracking & progression timeline
│       ├── chatbot.js           # Floating Customer AI Chatbot widget
│       ├── admin.js             # Dashboard metrics, orders manager, JWT auth
│       └── admin-ai.js          # Admin AI Assistant & Chart.js insights
│
├── server/
│   ├── config/
│   │   └── database.js          # Database connection & memory store fallback
│   ├── controllers/
│   │   ├── authController.js    # Admin login & session verification
│   │   ├── orderController.js   # Order placement, pricing, tracking
│   │   ├── adminController.js   # Order queries, status updater, KPIs, analytics
│   │   ├── chatbotController.js # Customer AI chat, booking draft, tracking
│   │   └── adminAIController.js # Admin AI chat, action confirmation, insights
│   ├── models/
│   │   ├── Customer.js          # Customer Mongoose schema
│   │   ├── Order.js             # Order, items, logistics, status history
│   │   ├── Service.js           # Configurable services & item catalog
│   │   └── Admin.js             # Admin credentials with bcrypt hashing
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT Bearer token protection
│   │   ├── validationMiddleware.js # Input sanitization & validation
│   │   ├── aiRateLimit.js       # AI rate limiting & prompt input sanitization
│   │   └── errorMiddleware.js   # Sanitized centralized error handler
│   ├── routes/
│   │   ├── authRoutes.js        # /api/auth
│   │   ├── orderRoutes.js       # /api/orders
│   │   ├── serviceRoutes.js     # /api/services
│   │   ├── chatbotRoutes.js     # /api/ai
│   │   ├── adminAIRoutes.js     # /api/admin/ai (JWT protected)
│   │   └── adminRoutes.js       # /api/admin (JWT protected)
│   ├── services/
│   │   ├── providers/
│   │   │   ├── ollamaProvider.js # Primary local Ollama /api/chat provider
│   │   │   ├── geminiProvider.js # Modular Google Gemini adapter
│   │   │   └── openaiProvider.js # Optional OpenAI REST adapter
│   │   ├── whatsappService.js   # Meta Cloud API & WhatsApp simulator
│   │   ├── conversationService.js # Isolated session context & TTL memory
│   │   └── aiService.js         # Provider-agnostic tool-calling & fallback service
│   ├── utils/
│   │   └── generateOrderId.js   # Order ID generator
│   ├── scripts/
│   │   └── seed.js              # Initial database seed script
│   └── server.js                # Express app entry point
│
├── test/
│   ├── test_api.js              # Automated end-to-end REST API test suite
│   └── test_ai_tools.js         # AI tool-calling, grounding & fallback tests
├── .env.example                 # Environment variables blueprint
├── .gitignore                   # Git ignore specifications
├── package.json                 # Project dependencies & scripts
└── README.md                    # Documentation & deployment guide
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [npm](https://www.npmjs.com/)

### 1. Installation
Clone or navigate to the project directory and install dependencies:

```bash
cd laundry-service-app
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default configuration in `.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/laundry_service
JWT_SECRET=laundry_secret_jwt_key_development_2026
ADMIN_WHATSAPP_NUMBER=8080082714
ADMIN_DEFAULT_EMAIL=admin@laundry.com
ADMIN_DEFAULT_PASSWORD=Admin@123456
APP_BASE_URL=http://localhost:5000

# AI Assistant (Primary: Free Local Ollama — No OpenAI Credits Required)
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
AI_MAX_TOKENS=600
AI_MAX_HISTORY_TURNS=10
AI_TIMEOUT_MS=45000
```

---

## 🦙 Free Local AI Setup (Ollama on Windows)

FreshWave Laundry uses **Ollama** running locally on your machine as its primary AI provider (`llama3.2:3b`) — **100% free with zero API charges**.

### Windows Installation & Setup

1. **Install Ollama for Windows**:
   * Download from [https://ollama.com/download/windows](https://ollama.com/download/windows) and run the installer.
   * Alternatively, install via `winget` in PowerShell:
     ```powershell
     winget install Ollama.Ollama
     ```
2. **Pull the Default Model (`llama3.2:3b`)**:
   Open a new PowerShell or Command Prompt window and run:
   ```powershell
   ollama pull llama3.2:3b
   ```
3. **Verify Ollama Is Running**:
   Ollama runs automatically in the background on `http://127.0.0.1:11434` (or start it manually with `ollama serve`). Verify with:
   ```powershell
   ollama list
   Invoke-RestMethod http://127.0.0.1:11434/api/tags
   ```
4. **Verify `.env` Configuration**:
   ```env
   AI_ENABLED=true
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3.2:3b
   ```
5. **Start FreshWave Laundry**:
   ```powershell
   cd C:\Users\YUVRAJ\.gemini\antigravity\scratch\laundry-service-app
   npm.cmd start
   ```
   Open [http://localhost:5000](http://localhost:5000) — the chatbot header will display `Local AI Online (llama3.2:3b)`.

### Switching Providers (Optional)
* **Google Gemini**: Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY=...`, `GEMINI_MODEL=gemini-2.0-flash`.
* **OpenAI**: Set `AI_PROVIDER=openai`, `OPENAI_API_KEY=...`, `OPENAI_MODEL=gpt-4o-mini`.
* **Graceful Fallback Mode**: If Ollama is stopped or `AI_ENABLED=false`, the app displays a friendly message with quick links to the standard booking form, order tracker, and WhatsApp (`8080082714`) without crashing.

### AI Endpoints Reference

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/ai/status` | Public | Check whether AI assistant is enabled and configured |
| `POST /api/ai/chat` | Public | Customer AI chatbot conversation with session memory & tool calls |
| `POST /api/ai/chat/clear` | Public | Clear customer chat session history |
| `POST /api/ai/booking-assistant` | Public | Conversational booking draft validation, backend quote & confirmed submission |
| `POST /api/ai/track-order` | Public | Verify Order ID + Phone and return order status summary |
| `POST /api/admin/ai/chat` | Admin JWT | Admin AI business assistant chat |
| `POST /api/admin/ai/chat/clear` | Admin JWT | Clear admin AI chat session history |
| `POST /api/admin/ai/confirm-action` | Admin JWT | Execute an explicitly confirmed order status update or cancellation |
| `GET /api/admin/ai/business-summary` | Admin JWT | Real database-backed operational summary, bottlenecks & delayed orders |
| `GET /api/admin/ai/revenue-insights` | Admin JWT | Daily 7-day trend, monthly comparison & service revenue breakdown |

> **Note**: If a local MongoDB instance is not running, the application **automatically boots into its built-in in-memory datastore**, allowing you to test all features immediately without any database setup!

### 3. Run the Application

#### Production Mode:
```bash
npm start
```

#### Development Mode (with nodemon):
```bash
npm run dev
```

#### Database Seeding (Optional):
```bash
npm run seed
```

#### Run Automated Test Suite:
```bash
npm test
```

### 4. Access URLs
* 🌐 **Customer Website**: [http://localhost:5000](http://localhost:5000)
* 📋 **Book Laundry Service**: [http://localhost:5000/booking.html](http://localhost:5000/booking.html)
* 📦 **Track Laundry Order**: [http://localhost:5000/tracking.html](http://localhost:5000/tracking.html)
* 🔒 **Admin Portal Login**: [http://localhost:5000/admin/login.html](http://localhost:5000/admin/login.html)
  * **Email**: `admin@laundry.com`
  * **Password**: `Admin@123456`

---

## 📱 WhatsApp Business API Setup

To send real WhatsApp messages via the **Meta WhatsApp Cloud API**:

1. Go to the [Meta for Developers Portal](https://developers.facebook.com/) and create a **WhatsApp Business App**.
2. Navigate to **WhatsApp > API Setup** in your App Dashboard.
3. Copy your **Temporary Access Token** (or Permanent System User Token) and **Phone Number ID**.
4. Add them to your `.env` file:
   ```env
   WHATSAPP_API_TOKEN=EAA...your_token
   WHATSAPP_PHONE_NUMBER_ID=102938475610293
   ADMIN_WHATSAPP_NUMBER=8080082714
   ```
5. Restart your server. The system will automatically use the live Meta Cloud API!

---

## 🌐 Free Cloud Deployment Guide

### Option 1: Deploy on Render (Recommended - Free Tier)

1. Create a free account at [Render](https://render.com/).
2. Click **New +** $\rightarrow$ **Web Service** and connect your GitHub repository.
3. Configure the service:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
4. In the **Environment Variables** section, add:
   * `NODE_ENV`: `production`
   * `PORT`: `10000`
   * `MONGODB_URI`: *Your MongoDB Atlas connection URI (or leave blank for memory store)*
   * `JWT_SECRET`: *A secure random string*
   * `ADMIN_WHATSAPP_NUMBER`: `8080082714`
   * `ADMIN_DEFAULT_EMAIL`: `admin@laundry.com`
   * `ADMIN_DEFAULT_PASSWORD`: *Your chosen strong password*
   * `APP_BASE_URL`: `https://your-app-name.onrender.com`
5. Click **Deploy Web Service**. Your laundry service app will be live globally!

---

### Option 2: Deploy on Railway

1. Sign up at [Railway](https://railway.app/).
2. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Add a **MongoDB Database** service from Railway with one click.
4. Set the environment variable `MONGODB_URI` to `${{MongoDB.MONGO_URL}}`.
5. Railway will automatically build and expose your application with an HTTPS domain.

---

### Option 3: Free Cloud Database (MongoDB Atlas)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Shared Cluster**.
3. Under **Database Access**, create a database user and password.
4. Under **Network Access**, add IP `0.0.0.0/0` (Allow access from anywhere).
5. Click **Connect** $\rightarrow$ **Drivers (Node.js)** and copy the connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/laundry_service?retryWrites=true&w=majority
   ```
6. Paste it as `MONGODB_URI` in your `.env` or cloud deployment settings.

---

## 🔒 Security Best Practices

* **Helmet Security Headers**: Protection against cross-site scripting, clickjacking, and MIME-sniffing.
* **CORS Protection**: Controlled cross-origin resource sharing.
* **Rate Limiting**: Protection against brute-force and DDoS attempts on public APIs (`express-rate-limit`).
* **Input Validation & Sanitization**: Strict server-side validation on mobile numbers, postal codes, and order parameters (`express-validator`).
* **Password Hashing**: Strong bcrypt salt rounds for administrator passwords.
* **JWT Stateless Authentication**: Secure token verification on all `/api/admin/*` routes.
* **Sanitized Errors**: No raw database schemas, stack traces, or credentials leaked to client responses in production.

---

## 📄 License & Credits
Built for small laundry businesses and dry cleaners to digitize their operations with modern web standards and instant WhatsApp communication.
