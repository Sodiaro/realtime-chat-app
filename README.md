# ChatApp

A real-time chat application built with React (Vite), Node.js, Express, Socket.IO, and MongoDB Atlas. Users can authenticate, chat in real-time, upload profile images, and personalize the UI with themes.

This project demonstrates full-stack development, authentication, WebSockets, and cloud integrations.

## Features

🔐 **Authentication**

Signup & Login

Secure passwords with bcrypt

JWT stored in HTTP-only cookies

💬 **Real-Time Chat**

Instant messaging with Socket.IO

Message history per user

Send images (Cloudinary upload)

Online users indicator

👤 **User Profile**

Update profile & avatar

Theme selection with live preview

🖌 **UI / UX**

Responsive layout

Built with TailwindCSS + DaisyUI

Toast notifications


## Tech Stack

**Frontend**

React + Vite | TailwindCSS + DaisyUI

React Router | React Hot Toast

**Backend**

Node.js + Express

Socket.IO | MongoDB Atlas

JWT + bcrypt | Cloudinary

## Getting Started (Local Development)

1️⃣ **Clone the repository**

```bash
git clone https://github.com/Sodiaro/realtime-chat-app.git
cd chat-app

```

2️⃣ **Backend Setup**

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

3️⃣ **Frontend Setup**

```bash
cd frontend
npm install

```

Run frontend:

```bash
npm run dev

```