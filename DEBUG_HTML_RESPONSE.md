# 🔍 Debugging HTML Instead of JSON Response

## The Problem
API endpoints are returning HTML instead of JSON.

## Diagnostic Steps

### Step 1: Restart the Server
```powershell
# Stop current server (Ctrl+C)
npm run dev
```

### Step 2: Test Which Server You're Hitting

Open your browser to **ONE** of these:

**Option A: Test via Vite Dev Server (CORRECT)**
```
http://localhost:5173/sermons
```
- Open DevTools (F12) → Network tab
- Look for `/api/sermons` request
- Check Response → Should be JSON

**Option B: Test via Backend Directly (WRONG - Will show HTML)**
```
http://localhost:5000/sermons
```
- This will return HTML because backend serves the built SPA
- This is the WRONG way to access during development

### Step 3: Use the API Test Page

Open this in your browser:
```
file:///C:/Users/oyooo/MUTSDA/test-api.html
```

Or serve it:
```powershell
# In project folder
python -m http.server 8080
# Then open: http://localhost:8080/test-api.html
```

Click the test buttons to see if responses are JSON or HTML.

### Step 4: Check Backend Console

After making a request, your backend console should show:

**✅ CORRECT (JSON):**
```
[API REQUEST] {
  method: 'GET',
  path: '/sermons',
  ...
}
[API RESPONSE] {
  path: '/api/sermons',
  contentType: 'application/json',
  dataType: 'object',
  hasSuccess: true
}
[API] GET /api/sermons 200 45ms
```

**❌ WRONG (HTML):**
```
[STATIC] GET /sermons 200 5ms
```

### Step 5: Check Browser Console

Open browser DevTools (F12) → Console

**✅ Should see:**
```
[Sermons] API response: { success: true, data: [...], count: 5 }
```

**❌ If you see:**
```
SyntaxError: Unexpected token '<' in JSON at position 0
```
This means HTML was returned instead of JSON.

## Common Causes

### 1. Accessing Wrong Port ❌
```
http://localhost:5000/sermons  ← WRONG (Backend serves HTML)
```

**Fix:** Use Vite dev server
```
http://localhost:5173/sermons  ← CORRECT (Proxies to backend)
```

### 2. Wrong Base URL in Code ❌

If `base44Client.js` has:
```javascript
export const getBackendUrl = () => {
  return 'https://mutsda.onrender.com';  // ← Wrong in development
};
```

**Fix:** Should auto-detect environment:
```javascript
export const getBackendUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';  // Dev
  }
  return 'https://mutsda.onrender.com';  // Production
};
```

### 3. Vite Proxy Not Working ❌

Check `vite.config.js`:
```javascript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    }
  }
}
```

### 4. Backend Route Not Registered ❌

Check server.js routes are registered:
```javascript
app.use('/api/sermons', sermonRouter);  // ✅ Registered
// ...other routes...
app.use(express.static('dist'));  // Must be AFTER API routes
```

## Quick Fix Checklist

- [ ] Using `http://localhost:5173` (not 5000)
- [ ] Backend running on port 5000
- [ ] Frontend (Vite) running on port 5173
- [ ] `base44Client.js` auto-detects environment
- [ ] Vite proxy configured in `vite.config.js`
- [ ] API routes registered BEFORE `express.static()`

## Test Endpoints Directly

Open terminal and test backend directly:

```powershell
# Test endpoint (should return JSON)
curl http://localhost:5000/api/test

# Test sermons (should return JSON)
curl http://localhost:5000/api/sermons

# If you get HTML, something is wrong with routing
```

## What Backend Console Should Show

When you access `http://localhost:5173/sermons`:

```
[API REQUEST] { method: 'GET', path: '/sermons', ... }
[API RESPONSE] { path: '/api/sermons', contentType: 'application/json', ... }
[API] GET /api/sermons 200 45ms
```

NOT:
```
[STATIC] GET /sermons 200 5ms  ← This means it served HTML
```

---

## Still Getting HTML?

1. **Check Network tab** in DevTools
   - Look at Request URL
   - Should be `http://localhost:5173/api/sermons`
   - NOT `http://localhost:5000/sermons`

2. **Check Response Headers**
   - `Content-Type` should be `application/json`
   - NOT `text/html`

3. **Check Response Preview**
   - Should show JSON object
   - NOT HTML code

4. **Share screenshots** of:
   - Network tab showing the request
   - Console showing the error
   - Backend console output
