# 🚀 Bun.js Auth API — Production Ready

A high-performance authentication REST API built with **Bun.js** + **MySQL**, featuring login and signup with JWT tokens.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun.js (native HTTP server) |
| Database | MySQL 8+ via `mysql2/promise` |
| Auth | JWT (HMAC-SHA256) + Refresh Tokens |
| Password | bcrypt via `Bun.password` |
| Multi-core | Bun Workers (one per CPU core) |

---

## 📁 Project Structure

```
src/
├── server.ts              # Entry point (single worker)
├── cluster.ts             # Multi-core cluster launcher
├── router.ts              # Route dispatcher + CORS + logging
├── controllers/
│   └── authController.ts  # signup() and login() handlers
├── db/
│   ├── pool.ts            # MySQL connection pool (20 connections)
│   ├── migrations.ts      # Table schemas
│   └── migrate.ts         # Migration runner
├── middleware/
│   ├── auth.ts            # JWT auth guard
│   └── rateLimiter.ts     # Sliding window rate limiter
└── utils/
    ├── crypto.ts          # bcrypt, JWT, token hashing
    ├── validators.ts      # Input validation
    └── logger.ts          # Structured JSON logger
```

---

## 🔧 Setup

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials and JWT_SECRET

# 4. Create MySQL database
mysql -u root -p -e "CREATE DATABASE auth_db; CREATE USER 'auth_user'@'localhost' IDENTIFIED BY 'yourpassword'; GRANT ALL ON auth_db.* TO 'auth_user'@'localhost';"

# 5. Run migrations
bun run migrate

# 6. Start server
bun run dev              # Development (hot reload)
bun run start            # Single core
bun run start:cluster    # All CPU cores (production)
```

---

## 📡 API Endpoints

### POST /api/auth/signup
```json
// Request
{
  "phone_number": "+919876543210",
  "full_name": "John Doe",
  "username": "johndoe",
  "password": "SecurePass1"
}

// Response 201
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": { "id": 1, "full_name": "John Doe", "username": "johndoe", "phone_number": "+919876543210" },
    "access_token": "eyJ...",
    "refresh_token": "abc123...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

### POST /api/auth/login
```json
// Request
{
  "phone_number": "+919876543210",
  "password": "SecurePass1"
}

// Response 200
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "access_token": "eyJ...",
    "refresh_token": "abc123...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

### GET /api/me (Protected)
```
Authorization: Bearer <access_token>
```

### GET /health
```json
{ "status": "ok", "uptime": 123.4, "ts": "2025-01-01T00:00:00.000Z" }
```

---

## 🏗️ Production Architecture

### Parallelism & Concurrency

| Feature | Implementation |
|---------|---------------|
| **Multi-core** | `cluster.ts` spawns one Bun Worker per CPU core using `SO_REUSEPORT`. OS distributes connections automatically. |
| **Async I/O** | All DB queries use `async/await` — Bun's event loop handles thousands of concurrent requests without blocking. |
| **Parallel queries** | `queryParallel()` runs multiple DB queries via `Promise.all()` — uniqueness checks in signup run simultaneously. |
| **Parallel token gen** | Access token + refresh token generated in parallel during login/signup. |
| **DB connection pool** | `mysql2` pool with 20 concurrent connections + 50 queued. Connections auto-released after each query. |

### Security
- ✅ bcrypt password hashing (cost factor 12)
- ✅ Timing-attack-safe password verification (always runs bcrypt even for unknown users)
- ✅ JWT signed with HMAC-SHA256
- ✅ Refresh token stored as SHA-256 hash
- ✅ Rate limiting: 5 login attempts / 10 signup attempts per IP per 15 min
- ✅ SQL injection prevention via parameterized queries
- ✅ CORS headers configurable per origin
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options)
- ✅ `multipleStatements: false` prevents statement stacking attacks

### Performance
- ✅ Connection pool auto-scales up to `DB_POOL_SIZE` connections
- ✅ Expired refresh tokens cleaned up in parallel on each login
- ✅ Structured JSON logging with response time
- ✅ Graceful shutdown with SIGINT/SIGTERM handlers

---

## 🔄 Production Deployment

```bash
# With PM2 (process manager)
pm2 start "bun src/cluster.ts" --name auth-api

# With Docker
FROM oven/bun:1-alpine
WORKDIR /app
COPY . .
RUN bun install --production
CMD ["bun", "src/cluster.ts"]
```
