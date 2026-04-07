# How to Deploy the Mailer Platform
### (No coding experience needed)

You will need accounts on 4 services. You already have 2 of them:
- ✅ **Supabase** — your database (already set up)
- ✅ **Netlify** — your frontend hosting (already set up)
- ⬜ **GitHub** — stores your code (free)
- ⬜ **Upstash** — a small background task queue (free)
- ⬜ **Railway** — runs the backend server (free tier available)

Total time: about 30–45 minutes.

---

## PART 1 — Set Up GitHub (store your code)

GitHub holds your code so that Railway and Netlify can automatically
pull from it and deploy.

1. Go to **github.com** and create a free account if you don't have one
2. Download and install **GitHub Desktop**: https://desktop.github.com
3. Open GitHub Desktop and sign in with your GitHub account
4. Click **File → Add Local Repository**
5. Navigate to the `mailer-platform` folder on your computer and click **Add**
6. If it asks "this folder is not a git repo, do you want to create one?" click **Yes**
7. In the bottom-left, type a summary like `Initial commit` then click **Commit to main**
8. Click **Publish repository** in the top bar
   - Uncheck "Keep this code private" if you want (it's fine either way)
   - Click **Publish Repository**
9. Your code is now on GitHub ✅

---

## PART 2 — Set Up the Database (Supabase)

### 2a. Find your database password

1. Go to **supabase.com** and open your project
2. In the left sidebar click **Project Settings** (gear icon at the bottom)
3. Click **Database** in the settings menu
4. Scroll down to find **Connection string** — click the **URI** tab
5. Copy the full connection string — it looks like:
   `postgresql://postgres:[YOUR-PASSWORD]@db.deoxceouzbdkafzgmrpp.supabase.co:5432/postgres`
6. **Write down or copy** this whole string — you'll need it in Part 4

> 💡 If you see `[YOUR-PASSWORD]` in the string, you need to replace it with your
> actual database password. If you forgot it, go to Settings → Database → Reset database password.

### 2b. Create all the database tables

1. In the Supabase left sidebar, click **SQL Editor** (the terminal icon)
2. Click **New query**
3. Open the file `SUPABASE_SETUP.sql` from the `mailer-platform` folder on your computer
   (right-click it and open with TextEdit or Notepad)
4. Select ALL the text (Cmd+A on Mac, Ctrl+A on Windows) and copy it
5. Paste it into the Supabase SQL Editor
6. Click the green **Run** button
7. You should see "Success. No rows returned" at the bottom ✅

---

## PART 3 — Set Up Redis (Upstash)

Redis is a small service the backend uses to manage email sending queues and
track link clicks. Upstash has a permanent free tier.

1. Go to **upstash.com** and create a free account (you can sign in with GitHub)
2. Click **Create Database**
3. Give it any name (e.g. `mailer-redis`)
4. Select a region close to you
5. Click **Create**
6. Once created, click on your database and find the **REST URL** section
7. Look for the line that says **UPSTASH_REDIS_URL** — it looks like:
   `rediss://default:xxxxx@your-db.upstash.io:6379`
8. **Copy this URL** — you'll need it in Part 4 ✅

---

## PART 4 — Deploy the Backend (Railway)

Railway will run the backend server that powers all the app logic.

1. Go to **railway.app** and click **Start a New Project**
2. Sign in with your GitHub account
3. Click **Deploy from GitHub repo**
4. Select your `mailer-platform` repository
5. Railway will detect it. When asked, set the **Root Directory** to `backend`
6. Click **Deploy**

### Add environment variables (the settings the server needs)

7. Once deployed, click on your service in Railway
8. Click the **Variables** tab
9. Add each of these variables one by one (click "Add Variable" for each):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string from Part 2a |
| `REDIS_URL` | Your Upstash Redis URL from Part 3 |
| `JWT_SECRET` | Any long random text, e.g. `my-super-secret-key-12345-change-this` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://your-netlify-site.netlify.app` ← you'll update this later |
| `BACKEND_URL` | Your Railway URL (see step 10 below) |

10. Click the **Settings** tab in Railway to find your app's public URL
    It looks like: `https://mailer-platform-backend-production.up.railway.app`
    Copy it and add it as the `BACKEND_URL` variable above

11. Railway will redeploy automatically when you add variables. Wait for it to show a green checkmark ✅

### Load the starter data (contacts, events, etc.)

12. In Railway, click on your service, then click the **Shell** tab (a terminal icon)
13. In the terminal that opens, type this command and press Enter:
    ```
    npx tsx src/db/seeds/seed.ts
    ```
14. Wait about 30 seconds. You should see messages about contacts being created ✅

---

## PART 5 — Deploy the Frontend (Netlify)

### 5a. Update the backend URL in your code

Before deploying to Netlify, you need to tell the frontend where the backend is.

1. On your computer, open the file:
   `mailer-platform/frontend/netlify.toml`
   (right-click → open with TextEdit or Notepad)

2. Find the line that says `YOUR_RAILWAY_URL` (it appears 3 times)
   Replace each one with your actual Railway URL from Part 4, step 10

   Example — change:
   ```
   to = "YOUR_RAILWAY_URL/api/:splat"
   ```
   To:
   ```
   to = "https://mailer-platform-backend-production.up.railway.app/api/:splat"
   ```

3. Save the file

4. In GitHub Desktop, you'll see the change. Type `Update backend URL` in the
   summary box and click **Commit to main**, then **Push origin** ✅

### 5b. Connect Netlify to your GitHub

5. Go to **netlify.com** and log into your account
6. Click **Add new site → Import an existing project**
7. Click **Deploy with GitHub**
8. Authorize Netlify to access your GitHub if asked
9. Select your `mailer-platform` repository
10. Set these options:
    - **Base directory**: `frontend`
    - **Build command**: `npm run build`
    - **Publish directory**: `frontend/dist`
11. Click **Deploy site**
12. Wait 2–3 minutes for it to build. You'll get a URL like `https://amazing-name-123.netlify.app` ✅

---

## PART 6 — Final: Connect Frontend ↔ Backend

Now tell the backend your frontend's actual URL so it can send correct links in emails.

1. Go back to **Railway**
2. Click on your backend service → **Variables** tab
3. Update `FRONTEND_URL` to your actual Netlify URL:
   e.g. `https://amazing-name-123.netlify.app`
4. Railway will redeploy automatically

---

## 🎉 You're Live!

Open your Netlify URL in a browser and log in with:
- **Email:** `admin@example.com`
- **Password:** `password123`

You should see the dashboard with 50 pre-loaded test contacts.

---

## Troubleshooting

**"Cannot connect to database" error on Railway**
→ Double-check your `DATABASE_URL` in Railway variables. Make sure the password
is filled in (no `[YOUR-PASSWORD]` placeholder).

**Frontend shows a blank white page**
→ Make sure the `netlify.toml` file has the correct Railway URL (no `YOUR_RAILWAY_URL` remaining).
Push the change via GitHub Desktop and wait for Netlify to redeploy.

**Login doesn't work**
→ The seed script may not have run. Go to Railway → Shell and run:
`npx tsx src/db/seeds/seed.ts`

**Railway shows "Build failed"**
→ Make sure the Root Directory is set to `backend` in Railway settings.

---

## Quick Reference — All Your URLs

Write these down once you have them:

| Service | URL |
|---------|-----|
| Supabase project | https://deoxceouzbdkafzgmrpp.supabase.co |
| Railway backend | (copy from Railway dashboard) |
| Netlify frontend | (copy from Netlify dashboard) |
| Upstash Redis | (in Upstash dashboard) |
