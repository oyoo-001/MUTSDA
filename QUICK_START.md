# 🚀 Quick Start Guide

## Start Development Environment

### Step 1: Open Terminal in Project Folder
```powershell
cd c:\Users\oyooo\MUTSDA
```

### Step 2: Start Both Servers
```powershell
npm run dev
```

This starts:
- 🔵 **Backend** → `http://localhost:5000` (API)
- 🟢 **Frontend** → `http://localhost:5173` (Your app)

### Step 3: Open Browser
```
http://localhost:5173
```

---

## ✅ What You Should See

### In Terminal
```
> concurrently "npm run server" "npm run client"

[0] [nodemon] starting `node server.js`
[0] MySQL Connected
[0] Database operation complete
[0] Server running on port 5000

[1] VITE v7.3.1  ready in 328 ms
[1] ➜  Local:   http://localhost:5173/
```

### In Browser Console (F12)
```
[Sermons] API response: { success: true, data: Array(5), count: 5 }
[Events] API response: { success: true, data: Array(3), count: 3 }
[Home] Events response: { success: true, data: Array(10), count: 10 }
```

### Backend Console
```
GET /api/sermons 200 45ms
GET /api/events 200 32ms
GET /api/harambees 200 28ms
```

---

## ❌ Common Issues

### Issue: "CORS Error"
**Problem:** Accessing `http://localhost:5000` instead of `5173`

**Solution:** Use `http://localhost:5173`

---

### Issue: "Cannot GET /api/sermons"
**Problem:** Backend not running

**Solution:** Run `npm run dev` (not just `npm run client`)

---

### Issue: "No data showing"
**Problem:** Backend not connected to database

**Solution:** 
1. Check `.env` file has correct database credentials
2. Check backend console for "MySQL Connected"

---

## 🎯 Testing Pages

### Test Order:
1. ✅ Home page → `http://localhost:5173/`
2. ✅ Sermons → `http://localhost:5173/sermons`
3. ✅ Events → `http://localhost:5173/events`
4. ✅ Harambee → `http://localhost:5173/harambee`
5. ✅ Gallery → `http://localhost:5173/gallery`
6. ✅ Admin Dashboard → `http://localhost:5173/admindashboard`

### What to Check:
- ✅ Data loads (not empty)
- ✅ No errors in console
- ✅ Console shows `[Page] API response:` logs
- ✅ Backend shows `GET /api/... 200` logs

---

## 🛠️ Development Tips

### Stop Servers
Press `Ctrl+C` in the terminal

### Restart After Code Changes
Backend auto-restarts (nodemon)
Frontend hot-reloads (Vite)

### Build for Production
```powershell
npm run build
```

### Sync to Android
```powershell
npx cap sync android
```

---

## 📝 Quick Reference

| What | URL |
|------|-----|
| Frontend Dev | `http://localhost:5173` |
| Backend API | `http://localhost:5000/api` |
| Production | `https://mutsda.onrender.com` |

---

**Ready to go! 🎉**
