# ⚠️ BEFORE YOU START - Important Information

## 🎯 Read This First!

This file contains critical information you MUST know before using the eCrew Auto Sync feature.

## ⚠️ Critical: Update Selectors First!

### The Problem:
The scraper uses **generic CSS selectors** that may not match eCrew's actual HTML structure.

### What This Means:
- The code is complete and functional ✅
- BUT selectors need to be customized to match real eCrew website ⚠️
- Without correct selectors, sync will fail ❌

### What You Must Do:

#### Step 1: Inspect eCrew Website

1. Open https://ecrew.etihad.ae/ecrew in Chrome/Firefox
2. Press `F12` to open DevTools
3. Try to login manually
4. Use the Inspector tool to find actual selectors for:
   - Email/Username input field
   - Password input field
   - Login/Submit button
   - Schedule/Roster navigation link
   - Schedule data table

#### Step 2: Update Selectors in Code

**File to Edit:** `src/lib/ecrew-scraper.ts`

**Locations to Update:**

```typescript
// 1. Email field selectors (around line 63)
const emailSelectors = [
  'input[type="email"]',
  'input[name="username"]',
  // ADD YOUR SELECTORS HERE based on inspection
];

// 2. Password field selectors (around line 86)
const passwordSelectors = [
  'input[type="password"]',
  'input[name="password"]',
  // ADD YOUR SELECTORS HERE
];

// 3. Submit button selectors (around line 104)
const submitSelectors = [
  'button[type="submit"]',
  'input[type="submit"]',
  // ADD YOUR SELECTORS HERE
];

// 4. Schedule link selectors (around line 234)
const scheduleSelectors = [
  'a[href*="schedule"]',
  'a[href*="roster"]',
  // ADD YOUR SELECTORS HERE
];

// 5. Table parsing logic (around line 274)
// Update column indices based on actual table structure
const flight = {
  date: cellTexts[0],        // Adjust index
  flightNumber: cellTexts[1], // Adjust index
  departure: cellTexts[2],    // Adjust index
  // etc...
};
```

#### Step 3: Test After Updates

```bash
npm run dev
# Test at http://localhost:3000/roster/import
```

## 🔍 How to Find Correct Selectors

### Method 1: Chrome DevTools Inspector

1. Open eCrew website
2. Right-click on element → "Inspect"
3. Look at HTML in Elements panel
4. Note the `id`, `name`, `class`, or other attributes
5. Create selector:
   - By ID: `#elementId`
   - By name: `[name="elementName"]`
   - By class: `.className`
   - By type: `input[type="email"]`

### Method 2: Copy Selector

1. Right-click element in Elements panel
2. Copy → Copy selector
3. Use that selector in code

### Example:

If you see:
```html
<input id="user_email" name="email" type="text" class="login-input">
```

You can use any of:
- `#user_email`
- `input[name="email"]`
- `input.login-input`
- `input[type="text"]`

## 🧪 Test Strategy

### Phase 1: Local Testing (Do This First!)

1. Update selectors as described above
2. Run `npm run dev`
3. Test login flow
4. Check console logs
5. Use screenshot feature if needed
6. Verify data extraction

### Phase 2: Verify Data

1. Check all fields are extracted correctly
2. Verify dates, times, flight numbers
3. Test with multiple flights
4. Test edge cases (missing data, special characters)

### Phase 3: Database Testing

1. Verify data saves to Supabase
2. Check no duplicate entries
3. Verify data integrity
4. Test with real user account

### Phase 4: Production Deployment

Only after all above tests pass!

## 🚨 Common Pitfalls

### 1. Assuming Selectors Work Out of the Box
❌ **Wrong**: Deploy without testing
✅ **Right**: Test and adjust selectors first

### 2. Skipping DevTools Inspection
❌ **Wrong**: Guess the selectors
✅ **Right**: Inspect actual HTML

### 3. Not Testing Locally First
❌ **Wrong**: Deploy to production immediately
✅ **Right**: Test thoroughly in development

### 4. Ignoring Console Logs
❌ **Wrong**: Hope it works
✅ **Right**: Check logs at every step

### 5. Not Using Screenshots
❌ **Wrong**: Wonder why it fails
✅ **Right**: Use `takeScreenshot()` to debug

## 📝 Pre-Flight Checklist

Before using eCrew Auto Sync:

### Development:
- [ ] I have inspected eCrew website in DevTools
- [ ] I have updated email input selectors
- [ ] I have updated password input selectors
- [ ] I have updated submit button selectors
- [ ] I have updated schedule link selectors
- [ ] I have updated table parsing logic
- [ ] I have tested login locally
- [ ] I have verified data extraction
- [ ] I have checked database writes
- [ ] All console logs look correct

### Database:
- [ ] Supabase project is set up
- [ ] Schema is created (ran supabase_schema.sql)
- [ ] Environment variables are set
- [ ] Can connect to database
- [ ] RLS policies are correct

### Deployment (if deploying):
- [ ] All local tests pass
- [ ] Vercel project is configured
- [ ] Environment variables set in Vercel
- [ ] Puppeteer option chosen (chrome-aws-lambda or external)
- [ ] Function timeout configured (60s+)
- [ ] Memory allocation sufficient (1GB+)

## 🛠️ Debugging Tools

### 1. Enable Screenshots

Add to your code:
```typescript
// In src/app/api/ecrew/sync/route.ts
const scraper = new EcrewScraper();
await scraper.initialize();

// After login
await scraper.takeScreenshot('/tmp/after-login.png');

// On schedule page
await scraper.takeScreenshot('/tmp/schedule.png');
```

### 2. Enable Detailed Logging

Add to `src/lib/ecrew-scraper.ts`:
```typescript
async initialize() {
  // ... existing code ...

  // Add these for debugging
  this.page.on('console', msg => console.log('Browser:', msg.text()));
  this.page.on('pageerror', error => console.log('Page error:', error));
  this.page.on('requestfailed', req => console.log('Request failed:', req.url()));
}
```

### 3. Increase Timeouts

If things are timing out:
```typescript
// In src/lib/ecrew-scraper.ts
this.page.setDefaultNavigationTimeout(120000); // 2 minutes
this.page.setDefaultTimeout(60000); // 1 minute
```

### 4. Run in Non-Headless Mode (Development Only)

```typescript
// In src/lib/puppeteer-config.ts
export function getPuppeteerLaunchOptions() {
  return {
    headless: false, // See the browser!
    // ... other options
  };
}
```

## 🔐 Security Reminders

### DO:
✅ Use HTTPS for all connections
✅ Validate all inputs
✅ Handle errors gracefully
✅ Log for debugging (but not credentials!)
✅ Test in isolated environment first

### DON'T:
❌ Store eCrew credentials
❌ Log passwords or sensitive data
❌ Skip input validation
❌ Deploy without testing
❌ Ignore security warnings

## 📞 When Things Go Wrong

### If Login Fails:
1. Check selectors match eCrew's actual HTML
2. Take screenshot to see what page looks like
3. Check browser console logs
4. Verify credentials are correct
5. Check if eCrew added CAPTCHA

### If No Flights Extracted:
1. Take screenshot of schedule page
2. Inspect table structure in DevTools
3. Update column indices in `extractFlights()`
4. Check if data is in different format
5. Look for JavaScript-rendered content

### If Database Insert Fails:
1. Check Supabase connection
2. Verify schema matches code
3. Check RLS policies
4. Look at Supabase logs
5. Verify data format (dates, etc.)

## 🎓 Learning Resources

### Before Starting:
1. **Puppeteer Basics**: https://pptr.dev/
2. **CSS Selectors**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
3. **Chrome DevTools**: https://developer.chrome.com/docs/devtools/

### During Development:
1. **Puppeteer Troubleshooting**: https://pptr.dev/troubleshooting
2. **Supabase Docs**: https://supabase.com/docs
3. **Next.js API Routes**: https://nextjs.org/docs/api-routes/introduction

## 🚦 Traffic Light System

### 🔴 RED - STOP! Don't Proceed If:
- You haven't inspected eCrew website
- Selectors are not updated
- Local testing hasn't been done
- Console shows errors
- Database not set up

### 🟡 YELLOW - Proceed with Caution If:
- Some tests pass but not all
- Occasional timeouts occur
- Some fields missing data
- Performance is slow

### 🟢 GREEN - Safe to Proceed When:
- All selectors updated and tested
- Local testing successful
- All flights extracted correctly
- Database writes working
- No console errors
- Ready for production

## 📋 Your Action Plan

1. **Right Now:**
   - [ ] Read this entire file
   - [ ] Understand the selector issue
   - [ ] Have DevTools ready

2. **Next:**
   - [ ] Inspect eCrew website
   - [ ] Document actual selectors
   - [ ] Update ecrew-scraper.ts
   - [ ] Test each step

3. **Then:**
   - [ ] Full local testing
   - [ ] Verify all data
   - [ ] Check database
   - [ ] Review logs

4. **Finally:**
   - [ ] Follow DEPLOYMENT.md
   - [ ] Deploy to staging
   - [ ] Test in production
   - [ ] Monitor results

## 🎯 Success Criteria

You're ready to deploy when:

✅ Login works consistently (100%)
✅ Schedule page loads correctly (100%)
✅ All flights extracted accurately (100%)
✅ All data fields populated correctly (95%+)
✅ Database writes successful (100%)
✅ No errors in console
✅ Performance acceptable (< 60s)
✅ Tested with multiple users/scenarios

## 💡 Pro Tips

1. **Start Simple**: Test login first, then add complexity
2. **Use Screenshots**: A picture is worth 1000 console.logs
3. **Test Incrementally**: Don't wait until end to test
4. **Keep Logs Clean**: Remove debug logs before production
5. **Document Changes**: Note what selectors you changed
6. **Version Control**: Commit working versions
7. **Have Backup**: Keep manual CSV import as fallback

## 🎉 When You're Ready

Once you've:
- ✅ Updated all selectors
- ✅ Tested locally
- ✅ Verified data accuracy
- ✅ Checked database integration

Then proceed to:
1. `QUICK_START.md` - For setup
2. `ECREW_SYNC_README.md` - For details
3. `DEPLOYMENT.md` - For production

---

## 🚨 FINAL WARNING

**DO NOT SKIP THIS FILE!**

The #1 reason eCrew Auto Sync fails is using generic selectors without updating them to match the actual eCrew website.

**5 minutes inspecting the website now = Hours saved debugging later!**

---

**You've been warned! Now go inspect that website! 🕵️**