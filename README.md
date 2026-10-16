
# ThoughtSnap 📸

**Share your photos. Express your thoughts. Connect with people.**

ThoughtSnap is a full-stack photo and thought-sharing social platform where users can create accounts, share posts, explore other users, manage their profiles, and receive notifications.

## 🌐 Live Demo

- **Frontend:** https://thoughtsnapp.vercel.app/
- **Backend:** https://thoughtsnap-backend.onrender.com/
- **GitHub:** https://github.com/pratiksinghs/ThoughtSnap

## ✨ Features

- 🔐 User registration and login
- 👤 User profiles
- 📸 Photo and thought sharing
- 📰 Social post feed
- 🔎 Discover other users
- 🤝 Follow users
- 🔔 Notifications
- ☁️ Cloud-based image storage
- 📱 Responsive user interface

## 🛠️ Tech Stack

**Frontend**
- HTML5
- CSS3
- JavaScript

**Backend**
- Node.js
- Express.js
- REST API

**Database and Storage**
- MongoDB Atlas
- Cloudinary

**Deployment**
- Vercel — Frontend
- Render — Backend
- GitHub — Version control

## 📂 Project Structure

```text
ThoughtSnap/
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── profile.html
│   └── notifications.html
└── README.md
```

*Note: The structure above is illustrative. Adjust folder and file names if your repository differs.*

## ⚙️ Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/pratiksinghs/ThoughtSnap.git
cd ThoughtSnap
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder and configure your own credentials:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Use the exact environment variable names expected by your backend configuration. Never commit real credentials or secrets.

Start the backend:

```bash
npm start
```

### 3. Run the frontend

Open the `frontend` folder in VS Code and serve it using a local web server. For example:

```bash
npx serve -l 5500
```

Make sure the frontend API URL points to your local backend when testing locally.

## 🔒 Security

- Keep API keys, database credentials, and secrets in environment variables.
- Never upload `.env` files to GitHub.
- Configure production environment variables in Render.
- Restrict database access and configure allowed frontend origins.

## 👨‍💻 Developer

**Pratik Singh**

- GitHub: [@pratiksinghs](https://github.com/pratiksinghs)
- Project: [ThoughtSnap](https://github.com/pratiksinghs/ThoughtSnap)

## 📄 License

This project is available for learning and portfolio purposes. Add a `LICENSE` file if you intend to distribute it under a specific open-source license.
