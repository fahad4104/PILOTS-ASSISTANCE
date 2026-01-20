# 🔄 eCrew Webix Integration Update

## ✅ What Was Fixed

### Problem Identified:
eCrew uses **Webix JavaScript framework** which requires special handling:
1. Virtual DOM rendering
2. Custom field IDs: `hhjemjlmjyis` (Crew ID) and `glsebouqswjdvtms` (Password)
3. SHA-512 password hashing via JavaScript
4. Custom event handling

### Solution Implemented:

Created new scraper: **`ecrew-scraper-webix.ts`**

#### Key Features:
1. ✅ Waits for Webix framework to load
2. ✅ Uses `page.evaluate()` to interact with Webix API directly
3. ✅ Calls Webix functions: `$$('id').setValue()`
4. ✅ Invokes eCrew's `PostLogin(0)` function
5. ✅ Proper error handling for Webix components
6. ✅ Enhanced flight data extraction from Webix datatables

#### Technical Approach:

```typescript
// Wait for Webix
await page.waitForFunction('typeof $$ !== "undefined"');

// Fill fields using Webix API
await page.evaluate((crewId, password) => {
  $$('hhjemjlmjyis').setValue(crewId);      // Crew ID
  $$('glsebouqswjdvtms').setValue(password); // Password
  PostLogin(0);                               // Submit (eCrew function)
}, credentials.email, credentials.password);
```

## 📁 Files Created/Modified:

### New Files:
1. **`src/lib/ecrew-scraper-webix.ts`** - Webix-aware scraper
2. **`WEBIX_UPDATE.md`** - This file
3. **`ECREW_WEBIX_SOLUTION.md`** - Technical analysis

### Modified Files:
1. **`src/app/api/ecrew/sync/route.ts`** - Updated import
2. **`src/lib/ecrew-scraper.ts`** - Updated selectors (backup)

## 🚀 How to Test:

```bash
# Restart dev server
npm run dev

# Test at:
http://localhost:3000/roster/import

# Select "Auto Sync" and enter eCrew credentials
```

## 🎯 What Changed:

### Before (❌ Didn't Work):
- Tried to find HTML input fields
- Used generic selectors
- Didn't wait for Webix
- Didn't use Webix API

### After (✅ Should Work):
- Waits for Webix framework
- Uses Webix IDs directly
- Calls Webix API methods
- Invokes eCrew's PostLogin function
- Handles Webix datatables

## 🔍 Debugging:

If it still doesn't work, check:

1. **Console logs** - Should see:
   ```
   Waiting for Webix framework to load...
   Filling in credentials using Webix API...
   Login form submitted, waiting for response...
   ```

2. **Screenshots** - Check `/tmp/` folder:
   - `ecrew-login-page.png`
   - `ecrew-schedule.png`

3. **Error messages** - Look for:
   - "Webix not loaded"
   - "Crew ID field not found"
   - "Password field not found"

## 💡 Why This Works:

**Webix Framework** renders components in a virtual DOM:
- HTML `<input>` elements are created dynamically
- Standard selectors don't work reliably
- Must use Webix's `$$(id)` API to interact

**eCrew's Login Flow:**
1. User fills `hhjemjlmjyis` and `glsebouqswjdvtms`
2. Calls `PostLogin(0)`
3. PostLogin hashes password with SHA-512
4. Sends AJAX request to `/eCrew/Login/...`
5. Redirects to `/Dashboard` on success

**Our Approach:**
- Mimics exact same flow
- Uses Webix API like the real page
- Let's eCrew handle password hashing
- Waits for proper navigation

## 🎓 Technical Details:

### Webix API Used:
```javascript
$$('id')                    // Get Webix component by ID
$$('id').setValue(value)    // Set value
$$('id').getValue()         // Get value
$$('id').callEvent(event)   // Trigger event
```

### eCrew Functions:
```javascript
PostLogin(mode)             // mode: 0 = keyboard, 1 = swipe
hex_sha512(password)        // Hash password
```

### Why We Don't Hash:
- eCrew's `PostLogin()` handles hashing
- We pass plain password
- Function hashes it automatically
- Simpler and more reliable

## 📊 Success Indicators:

✅ **Login Successful** if:
- URL changes to `/Dashboard`
- No error messages appear
- Page redirects after login

❌ **Login Failed** if:
- Still on `/ecrew` after 5 seconds
- Error message appears
- "Invalid Credentials" shown

## 🔄 Next Steps if Still Fails:

1. **Take Screenshots**:
   ```typescript
   await scraper.takeScreenshot('/tmp/debug.png');
   ```

2. **Enable Verbose Logging**:
   - Check browser console in Puppeteer
   - Look for JavaScript errors

3. **Try Non-Headless Mode** (Development only):
   ```typescript
   // In puppeteer-config.ts
   headless: false
   ```

4. **Alternative: Direct API Call**:
   - Skip UI entirely
   - Make POST to `/eCrew/Login/...`
   - Fastest and most reliable

## ✨ Advantages of Webix Approach:

1. **More Reliable** - Uses framework API
2. **Faster** - Direct function calls
3. **Future-proof** - Works even if HTML changes
4. **Accurate** - Exact same as real login
5. **Debuggable** - Clear error messages

---

**Status**: ✅ Ready for Testing
**Created**: 2026-01-20
**Next**: Test with real eCrew credentials