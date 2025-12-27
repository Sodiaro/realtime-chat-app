# ChatApp 💬

A real-time chat application built with **React (Vite)**, **Node.js**, **Express**, **Socket.IO**, and **MongoDB Atlas**.  
Users can authenticate, chat in real time, upload profile images, and personalize the UI with themes.

This project demonstrates **full-stack development, authentication, WebSockets, and cloud integrations**.

---

## ✨ Features

### 🔐 Authentication
- User signup & login
- Secure password hashing with **bcrypt**
- **JWT** stored in **HTTP-only cookies**

### 💬 Real-Time Chat
- Instant messaging with **Socket.IO**
- Message history
- Image messaging via **Cloudinary**
- Online user indicators

### 👤 User Profile
- Update profile details
- Upload avatar
- Select UI theme with live preview

### 🖌 UI / UX
- Responsive layout
- **TailwindCSS + DaisyUI**
- Toast notifications
- Smooth developer-friendly UX

---

## 🛠 Tech Stack

### Frontend
- React + Vite  
- TailwindCSS + DaisyUI  
- React Router  
- React Hot Toast  

### Backend
- Node.js + Express  
- Socket.IO  
- MongoDB Atlas  
- JWT Authentication  
- bcrypt  
- Cloudinary  

---

## 🚀 Getting Started (Local Development)

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Sodiaro/realtime-chat-app.git
cd realtime-chat-app

```

### 2️⃣ Backend Setup

```bash
cd backend
npm install

```
Create a `.env` file:

```ini
PORT=5001
MONGODB_URL=your_mongodb_uri
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
CORS_ORIGIN=http://localhost:5173

```
Build the app

```bash
npm run build

```

Start the app

```bash
npm start

```

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install

```

Run frontend:

```bash
npm run dev

```

Frontend runs at:

```bash
http://localhost:5173

```

Backend runs at:

```bash
http://localhost:5001

```

## 📦 Deployment

You can deploy using platforms like:

Vercel (Frontend)

Render / Railway (Backend)

MongoDB Atlas (Database)


## 👨‍💻 Author

Sodiq Semiu
Full-Stack Developer

📧 Email: sodiqsemiu.dev@gmail.com

🔗 LinkedIn: https://www.linkedin.com/in/sodiq-semiu/