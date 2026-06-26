# JobHit Local Desktop App Setup Guide

This folder contains the isolated, secure local version of **JobHit**. Your credentials, resume text, session cookies, and scraped jobs are stored entirely on your local machine, keeping your data ultra-secure.

---

## Prerequisites

Make sure you have the following installed on your machine:
1. **Node.js** (v18 or higher): Download from [nodejs.org](https://nodejs.org/).
2. **MongoDB**: Install locally from [mongodb.com](https://www.mongodb.com/try/download/community) or set up a free database cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

---

## Setup Instructions

### Step 1: Configure Environment Variables
1. Go to the `backend/` folder.
2. Duplicate the `.env.example` file and rename it to `.env`.
3. Open `.env` in a text editor and fill in the values:
   - Generate a 32-character hexadecimal secret key for `ENCRYPTION_SECRET`. (You can run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` in your terminal to get one).
   - Enter your local/remote MongoDB connection string in `DATABASE_URL`.
   - Optionally enter your Gemini API Key in `GEMINI_API_KEY` (or configure it later inside the UI dashboard).

### Step 2: Install Dependencies
Open your terminal at the `desktop-app/` root directory and run:

```bash
# Install backend dependencies
cd backend
npm install

# Run database generation to setup Prisma client
npx prisma generate
npx prisma db push

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 3: Run the Application (Development Mode)

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```
   The backend starts running on `http://localhost:5000`.

2. Start the frontend dashboard:
   ```bash
   cd ../frontend
   npm run dev
   ```
   This will open the development server at `http://localhost:3000/jobhit`.

---

## Production Build (Single Server Execution)

If you want to compile the frontend and run the entire application on a single Express port (no proxy required):

1. Compile the frontend build:
   ```bash
   cd frontend
   npm run build
   ```
   Vite will automatically compile the bundle and place it inside the `backend/public` static directory.

2. Start the production backend server:
   ```bash
   cd ../backend
   npm run build
   npm start
   ```
   Now you can open your browser and navigate to **`http://localhost:5000/jobhit`** to run the complete desktop application!
