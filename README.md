# DevChat 💬

A production-grade, real-time messaging platform built with **React (Vite)**, **Node.js + Express (TypeScript)**, **Socket.IO**, and **MongoDB**.

DevChat goes well beyond a basic chat demo — it includes rich messaging, voice/video calls, groups & communities, stories, disappearing & view-once messages, granular privacy controls, web push, and full observability (metrics, structured logs, OpenAPI docs).

🔗 **Live Demo:** [https://devchat-8dde.onrender.com/](https://devchat-8dde.onrender.com/)

---

## ✨ Features

### 🔐 Authentication & Account Security
- Signup / login with **bcrypt**-hashed passwords
- **JWT** in **HTTP-only cookies**, with token-versioning + **per-device sessions** (see & revoke active devices)
- Forgot / reset password by **email or username** via crypto-secure **OTP codes** (hashed, brute-force lockout; codes never exposed in responses)
- Change password, log out all other devices, delete account

### 💬 Real-Time Messaging
- Instant delivery over **Socket.IO** (optional **Redis adapter** for multi-node scaling)
- Text, **images**, **voice notes** (waveform player with 1×/1.5×/2× speed), **files/documents**, **location sharing**, **contact cards**, **polls**, and **link previews**
- Replies, reactions, edit, delete, pin, star, and **forwarding across any conversation type** (DM↔group)
- **@mentions**, delivery & read receipts, typing / recording indicators
- Message search, **scheduled messages**, and per-chat **drafts**
- Per-conversation **scroll restoration** (reopen where you left off)

### 👁️ View Once
- Single-view content for **images, videos, documents, voice notes, and text**
- Opens in a **dedicated fullscreen viewer**; consumed the moment it's opened or you look away
- Neither sender nor recipient can reopen it; best-effort capture deterrents

### ⏱️ Disappearing Messages
- Per-conversation timer (off / 1 day / 1 week); affects new messages only
- In-timeline **system notices** when toggled + a header indicator; configurable default for new chats

### 👥 Groups
- Roles/admins, **invite links**, group photo & description, admins-only posting, group read receipts
- **200-member cap** and **unique group names**

### 🏘️ Communities
- A community bundles multiple groups + a shared **announcement channel** (admins post, everyone reads)
- À-la-carte membership (belong to some groups, not all), admin management, unique community & group names

### 📞 Calls
- **1:1 voice & video** calls over **WebRTC**, with a call-history timeline and accurate **Ringing/Calling** status _(group calling is on the roadmap)_

### 📸 Stories / Status
- 24-hour statuses with view receipts

### 🛡️ Privacy
- Visibility controls for **last seen**, **profile photo**, and **read receipts**
- **Ghost Mode** (suppresses read/edit/delete/status-view signals, with a visible indicator for transparency)
- **Block / unblock** users; self-chat **Notes** space

### 🎨 Personalization & UX
- Light / dark / **system** themes + chat **wallpapers**
- **Resizable** desktop sidebars, slide-over panels (Contacts / Calls / Scheduled / Starred), unified conversation list with All/Chats/Groups tabs, archived chats, mute indicators
- Comprehensive **Settings** page (profile, privacy, notifications, chat prefs, appearance, security, account…)
- Browser notifications + **Web Push** (VAPID)

---

## 🛠 Tech Stack

**Frontend:** React + Vite · Zustand · TailwindCSS + DaisyUI · React Router · React Hot Toast · WebRTC / Web Audio

**Backend:** Node.js + Express (**TypeScript**) · Socket.IO (+ optional Redis adapter) · MongoDB + Mongoose · JWT · bcrypt · Cloudinary · Nodemailer (OTP email) · web-push (VAPID) · Zod (env validation) · Pino (structured logs) · prom-client (Prometheus metrics) · Swagger / OpenAPI

**Testing:** Vitest · Supertest · mongodb-memory-server

---

## 🚀 Getting Started (Local Development)

### 1️⃣ Clone
```bash
git clone https://github.com/Sodiaro/realtime-chat-app.git
cd realtime-chat-app
```

### 2️⃣ Backend
```bash
cd backend
npm install
```

Create a `backend/.env` file:

```ini
# Required
MONGODB_URI=your_mongodb_uri
JWT_SECRET=at_least_16_characters
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
CORS_ORIGIN=http://localhost:5173   # comma-separated for multiple origins

# Optional — multi-node scaling
REDIS_URL=redis://localhost:6379

# Optional — real OTP emails (without these, OTPs are logged in dev)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=DevChat <no-reply@devchat.local>

# Optional — Web Push (disabled if absent)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@devchat.local
```

Run it:
```bash
npm run dev      # watch mode
# or
npm run build && npm start
```

### 3️⃣ Frontend
```bash
cd frontend
npm install
npm run dev
```

- Frontend → `http://localhost:5173`
- Backend → `http://localhost:5001`

### 🧪 Tests
```bash
cd backend
npm test
```

---

## 📚 API Docs & Observability
- **Swagger UI:** `/api-docs` (OpenAPI JSON at `/api-docs.json`)
- **Metrics:** `/metrics` (Prometheus) · **Health:** `/health` · **Readiness:** `/ready`

---

## 📦 Deployment
- **Frontend:** Vercel / Netlify (or served by the backend in production)
- **Backend:** Render / Railway / Fly.io
- **Database:** MongoDB Atlas · **Optional:** Redis (multi-node Socket.IO)
- **Calls (optional):** set `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` to add a TURN server — required for calls between symmetric NATs.

### Notes for production
- **Name uniqueness** is enforced both in app logic and by **sparse unique indexes** (`Community.nameKey`, `Conversation.nameKey`). Mongoose creates these on boot. The indexes are *sparse*, so pre-existing documents without `nameKey` are skipped — no migration needed; new/edited names are normalized to a lowercased key automatically.
- **Presence, group-call rooms and ghost-mode state are in-memory (single-node).** For horizontal scaling, run Redis (Socket.IO adapter) and move that ephemeral state into shared storage.
- **Rate limits:** all `/api` routes share a limiter; community/invite creation has a tighter per-hour cap to curb abuse.

---

## 👨‍💻 Author

**Sodiq Semiu** — Full-Stack Developer

📧 sodiqsemiu.dev@gmail.com  
🔗 [LinkedIn](https://www.linkedin.com/in/sodiq-semiu/)
