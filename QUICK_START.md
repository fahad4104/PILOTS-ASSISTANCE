# eCrew Auto Sync - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 min)

```bash
cd c:\Users\faua\pilot-assistance
npm install
```

✅ **Done!** Puppeteer is already installed.

### Step 2: Configure Environment (2 min)

Your `.env.local` file is already set up with:
- ✅ Supabase URL and Key
- ✅ Other required credentials

**No changes needed!**

### Step 3: Set Up Database (1 min)

1. Go to your Supabase project dashboard:
   https://jmzzavlqzhmqoktvzqac.supabase.co

2. Navigate to **SQL Editor**

3. Copy and paste content from `supabase_schema.sql`

4. Click **Run**

✅ **Database ready!**

### Step 4: Start Development Server (30 sec)

```bash
npm run dev
```

Open: http://localhost:3000

### Step 5: Test the Feature (30 sec)

1. Navigate to: http://localhost:3000/roster/import
2. Click **"Auto Sync"** tab
3. Enter your eCrew credentials
4. Click **"Sync Roster"**

✅ **That's it!**

## 🧪 Quick Test

Test the API directly:

```bash
curl -X POST http://localhost:3000/api/ecrew/sync \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "ecrewEmail": "your.email@etihad.ae",
    "ecrewPassword": "your-password"
  }'
```

## 📝 What You Should See

### Success Response:
```json
{
  "success": true,
  "message": "Successfully synced 15 flights from eCrew",
  "syncedCount": 15,
  "flights": [...]
}
```

### Browser Console Logs:
```
Navigating to eCrew login page...
Filling in credentials...
Submitting login form...
Login successful!
Navigating to My Schedule page...
Extracting flight data...
Extracted 15 flights
```

## ⚠️ Important First-Time Notes

### 1. Adjust Selectors (if needed)

If the sync fails, you may need to update the HTML selectors to match eCrew's actual structure:

**File:** `src/lib/ecrew-scraper.ts`

**Lines to check:**
- Line 63-69: Email field selectors
- Line 86-92: Password field selectors
- Line 104-114: Submit button selectors
- Line 234-242: Schedule link selectors

**How to find correct selectors:**
1. Open https://ecrew.etihad.ae/ecrew in your browser
2. Press F12 to open DevTools
3. Use Inspector to find the correct selectors
4. Update the arrays in `ecrew-scraper.ts`

### 2. Take Screenshots for Debugging

Add this to see what Puppeteer sees:

```typescript
// In src/app/api/ecrew/sync/route.ts
// After login:
await scraper.takeScreenshot('/tmp/after-login.png');

// After navigation:
await scraper.takeScreenshot('/tmp/schedule-page.png');
```

### 3. Check Browser Console

Open browser DevTools (F12) to see detailed logs during sync.

## 🔧 Common Issues & Quick Fixes

### Issue: "Browser not initialized"
```bash
# Install Chromium
npm install puppeteer  # This installs bundled Chromium
```

### Issue: "Could not find email/username input field"
**Fix:** Update selectors in `ecrew-scraper.ts` (see above)

### Issue: "Navigation timeout"
**Fix:** Increase timeout in `ecrew-scraper.ts`:
```typescript
this.page.setDefaultNavigationTimeout(120000); // 2 minutes
```

### Issue: "No flights extracted"
**Fix:** Update table parsing logic in `extractFlights()` method

## 📖 Next Steps

Once basic testing works:

1. **Deploy to Vercel** → See [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Production Testing** → See [test-ecrew-sync.md](test-ecrew-sync.md)
3. **User Testing** → Share with pilot users

## 📚 Full Documentation

- **Technical Details**: [ECREW_SYNC_README.md](ECREW_SYNC_README.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **User Guide**: [USAGE_GUIDE.md](USAGE_GUIDE.md) (Arabic)
- **Testing**: [test-ecrew-sync.md](test-ecrew-sync.md)
- **Summary**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## 🎯 Quick Reference

### File Locations:
- **Scraper**: `src/lib/ecrew-scraper.ts`
- **API**: `src/app/api/ecrew/sync/route.ts`
- **Frontend**: `src/app/roster/import/page.tsx`
- **Config**: `src/lib/puppeteer-config.ts`
- **Database**: `src/lib/supabase.ts`

### Key Functions:
- `scrapeEcrewSchedule()`: Main scraping function
- `EcrewScraper.login()`: Handles authentication
- `EcrewScraper.extractFlights()`: Parses flight data

### Environment Variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

## ✅ Verification Checklist

After setup, verify:

- [ ] Development server starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can see Import page at /roster/import
- [ ] Auto Sync tab is visible
- [ ] Can enter credentials
- [ ] Sync button is clickable
- [ ] Database tables exist in Supabase

## 🆘 Need Help?

1. **Check logs**: Browser console + Terminal
2. **Review docs**: See files listed above
3. **Debug**: Use screenshots and console.log
4. **Test locally**: Before deploying to production

---

**Time to First Sync:** ~5 minutes
**Time to Production:** ~30 minutes (including deployment)

Happy syncing! ✈️