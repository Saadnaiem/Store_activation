# In-Store Activation Portal - Render Deployment Guide

This project is a real-time portal connected directly to **Firebase** (Cloud Firestore, Firebase Authentication, Firebase Storage).

---

## 🚀 How to Deploy to Render

You have two fast options to deploy on Render:

### Option 1: Deploy as a Static Site (Fastest & Free)
1. Push your repository to **GitHub** or **GitLab**.
2. Go to your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** -> **Static Site**.
4. Connect your GitHub repository.
5. Set:
   - **Name**: `in-store-activation-portal`
   - **Branch**: `main` (or your branch)
   - **Build Command**: *(leave blank)*
   - **Publish Directory**: `.` *(current directory / root)*
6. Click **Create Static Site**.

---

### Option 2: Deploy as a Web Service (Node.js)
1. Push your repository to **GitHub**.
2. In Render Dashboard, click **New +** -> **Web Service**.
3. Select your repository.
4. Settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
5. Click **Create Web Service**.

*(Or click **New +** -> **Blueprint** and Render will automatically read [render.yaml](render.yaml)).*

---

## ⚠️ Crucial Step for Firebase Google Sign-In

Once your app is deployed, Render assigns you a URL (for example: `https://in-store-activation-portal.onrender.com`).

To make sure Google Sign-In works on Render without security errors:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **in-store-activation**.
3. In the left sidebar, navigate to **Build** -> **Authentication**.
4. Click on the **Settings** tab at the top -> **Authorized domains**.
5. Click **Add domain**.
6. Enter your Render domain: `in-store-activation-portal.onrender.com` (do not include `https://`).
7. Click **Save**.

Your live portal is now fully functional with database persistence, real-time sync, and authentication on Render!
