# ⚠️ eCrew Uses Webix Framework - Important Discovery

## 🔍 What We Found

From the HTML code analysis:

1. **Framework**: eCrew uses **Webix** JavaScript framework
2. **Field IDs**: Uses encrypted/obfuscated IDs:
   - Crew ID: `hhjemjlmjyis`
   - Password: `glsebouqswjdvtms`

3. **Password Hashing**: Uses SHA-512 before sending:
   ```javascript
   password: hex_sha512(password)
   ```

4. **Login Function**: JavaScript-based:
   ```javascript
   function PostLogin(mode,hotp=''){
     var crewid = myform.getValues().hhjemjlmjyis;
     var password = hex_sha512(myform.getValues().glsebouqswjdvtms);
     // ... AJAX call to /eCrew/Login/R7ZG6XKqn...
   }
   ```

## 🎯 Solutions

### Solution 1: Use JavaScript Execution (Recommended)

Instead of filling form fields, execute JavaScript directly:

```typescript
// Wait for Webix to load
await this.page.waitForFunction('typeof $$ !== "undefined"');

// Fill using Webix API
await this.page.evaluate((email, password) => {
  $$('hhjemjlmjyis').setValue(email);
  $$('glsebouqswjdvtms').setValue(password);
  $$('loginbtn').callEvent('onItemClick', []);
}, credentials.email, credentials.password);
```

### Solution 2: Direct API Call (Fastest)

Make the same AJAX call that eCrew makes:

```typescript
const sha512Hash = crypto.createHash('sha512').update(password).digest('hex');

const response = await fetch('https://ecrew.etihad.ae/eCrew/Login/R7ZG6XKqn...', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    crewid: crewid.trim(),
    password: sha512Hash,
    // ... other params
  })
});
```

### Solution 3: Updated Puppeteer Approach (Current)

Use the correct selectors we just updated:
- `input[name="hhjemjlmjyis"]` for Crew ID
- `input[name="glsebouqswjdvtms"]` for Password
- `button[id="loginbtn"]` for Login button

## 🚀 Next Steps

1. **Test the updated scraper** with new selectors
2. **If it fails**: Implement Solution 1 (JavaScript execution)
3. **For production**: Consider Solution 2 (direct API) for reliability

## 📝 Implementation Notes

The scraper has been updated with:
✅ Correct field selectors for Webix
✅ Longer timeout (20s instead of 10s)
✅ eCrew-specific CSS classes
✅ eCrew button selectors

## ⚠️ Important

If the scraper still fails, we need to:
1. Use `page.evaluate()` to interact with Webix framework directly
2. Or implement direct API calls bypassing the UI entirely

Both approaches will work around Webix's virtual DOM rendering.