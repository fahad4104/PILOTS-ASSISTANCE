# Testing eCrew Auto Sync

## Local Testing

### 1. Prerequisites

```bash
# Install dependencies
npm install

# Ensure .env.local has Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test Flow

1. **Register/Login**
   - Navigate to `http://localhost:3000`
   - Register or login with test account

2. **Go to Import Page**
   - Click on "Roster" from homepage
   - Click "Import Roster" button
   - Select "Auto Sync" tab

3. **Test Auto Sync**
   - Enter eCrew credentials
   - Click "Sync Roster"
   - Watch browser console for logs

4. **Expected Behavior**
   ```
   Console Logs:
   - "Navigating to eCrew login page..."
   - "Filling in credentials..."
   - "Submitting login form..."
   - "Login successful!"
   - "Navigating to My Schedule page..."
   - "Extracting flight data..."
   - "Extracted X flights"
   ```

5. **Verify Results**
   - Check preview table shows flights
   - Verify data accuracy
   - Click "Confirm Import"
   - Check Roster page shows flights

## Manual Testing Checklist

### Happy Path
- [ ] User can enter credentials
- [ ] Sync button becomes disabled during sync
- [ ] Loading message appears
- [ ] Preview shows correct number of flights
- [ ] All flight data fields are populated
- [ ] Confirm import saves to database
- [ ] Redirect to Roster page works
- [ ] Flights appear in Roster page

### Error Handling
- [ ] Invalid credentials show error message
- [ ] Network timeout shows error
- [ ] Empty schedule handled gracefully
- [ ] Duplicate sync handled properly
- [ ] Database errors caught and displayed

### Edge Cases
- [ ] Very long flight numbers
- [ ] Special characters in pilot names
- [ ] Missing optional fields (co-pilot)
- [ ] Future dated flights
- [ ] Past dated flights

## API Testing

### Using curl

```bash
# Test the sync endpoint
curl -X POST http://localhost:3000/api/ecrew/sync \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "ecrewEmail": "test@etihad.ae",
    "ecrewPassword": "test-password"
  }'
```

### Expected Success Response

```json
{
  "success": true,
  "message": "Successfully synced 15 flights from eCrew",
  "syncedCount": 15,
  "flights": [
    {
      "id": "...",
      "user_id": "...",
      "date": "2026-01-20",
      "flight_number": "EY123",
      "departure": "AUH",
      "destination": "LHR",
      "departure_time": "08:30",
      "arrival_time": "13:45",
      "aircraft": "B787-9",
      "co_pilot": "Capt. Ahmed",
      "status": "scheduled",
      "created_at": "..."
    }
  ]
}
```

### Expected Error Response

```json
{
  "success": false,
  "error": "Failed to connect to eCrew",
  "details": "Login failed: Invalid credentials"
}
```

## Debugging

### Enable Debug Mode

Add to `src/lib/ecrew-scraper.ts`:

```typescript
async initialize() {
  this.browser = await createBrowser();
  this.page = await this.browser.newPage();

  // Enable debug
  this.page.on('console', msg => console.log('Browser:', msg.text()));
  this.page.on('pageerror', error => console.log('Page error:', error));

  // ... rest of initialization
}
```

### Take Screenshots

```typescript
// In route.ts, after scraping
const scraper = new EcrewScraper();
await scraper.initialize();
await scraper.login(credentials);
await scraper.takeScreenshot('/tmp/after-login.png');
await scraper.navigateToSchedule();
await scraper.takeScreenshot('/tmp/schedule-page.png');
```

### Check Logs

```bash
# Development logs
npm run dev

# Production logs (Vercel)
vercel logs
```

## Performance Testing

### Measure Sync Duration

```typescript
// In route.ts
console.time('eCrew Sync');
const flights = await scrapeEcrewSchedule(credentials);
console.timeEnd('eCrew Sync');
// Expected: 30-60 seconds
```

### Monitor Memory Usage

```bash
# During sync, check Node.js memory
node --expose-gc --inspect server.js
```

## Common Issues & Solutions

### Issue 1: Browser Fails to Launch

**Symptoms**: Error "Failed to initialize browser"

**Solutions**:
```bash
# Install Chromium
sudo apt-get install chromium-browser

# Or install Puppeteer's bundled Chromium
npx puppeteer browsers install chrome
```

### Issue 2: Selectors Not Found

**Symptoms**: Error "Could not find email/username input field"

**Solution**: Update selectors in `ecrew-scraper.ts` to match actual eCrew HTML

### Issue 3: Timeout Errors

**Symptoms**: Navigation timeout or page load timeout

**Solutions**:
- Increase timeout in `ecrew-scraper.ts`:
  ```typescript
  this.page.setDefaultNavigationTimeout(120000); // 2 minutes
  ```
- Check internet connection
- Verify eCrew website is accessible

### Issue 4: No Flights Extracted

**Symptoms**: Sync succeeds but 0 flights returned

**Solution**:
1. Take screenshot of schedule page
2. Inspect HTML structure
3. Update table parsing logic in `extractFlights()`

## Integration Testing

### Test with Real eCrew Account

⚠️ **Important**: Use test account, not production pilot credentials

1. Create test account on eCrew (if possible)
2. Add some test flights
3. Run sync with test credentials
4. Verify extracted data matches eCrew

### Database Verification

```sql
-- Check inserted flights
SELECT * FROM flights
WHERE user_id = 'test-user-id'
ORDER BY created_at DESC
LIMIT 10;

-- Check for duplicates
SELECT flight_number, date, COUNT(*)
FROM flights
WHERE user_id = 'test-user-id'
GROUP BY flight_number, date
HAVING COUNT(*) > 1;
```

## Security Testing

### Test Credential Handling

- [ ] Verify credentials not logged to console
- [ ] Check credentials not in API response
- [ ] Confirm credentials not in database
- [ ] Test SQL injection in inputs
- [ ] Test XSS in extracted data

### Test Rate Limiting (if implemented)

```bash
# Send multiple requests quickly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/ecrew/sync \
    -H "Content-Type: application/json" \
    -d '{"userId":"test","ecrewEmail":"test@test.com","ecrewPassword":"test"}' &
done
```

## Automated Testing (Future)

### Jest Test Template

```typescript
// __tests__/ecrew-sync.test.ts

describe('eCrew Sync', () => {
  it('should extract flight data correctly', async () => {
    const mockFlights = [
      { date: '2026-01-20', flightNumber: 'EY123', /* ... */ }
    ];

    // Mock Puppeteer
    // Test extraction logic
    // Assert results
  });

  it('should handle login errors', async () => {
    // Test with invalid credentials
    // Assert error response
  });
});
```

## Pre-Production Checklist

Before deploying to production:

- [ ] All manual tests pass
- [ ] Error handling tested
- [ ] Performance acceptable (< 60s)
- [ ] Security tests pass
- [ ] Database schema verified
- [ ] Environment variables set
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup/rollback plan ready
- [ ] Documentation updated

## Monitoring in Production

### Key Metrics to Track

1. **Success Rate**: % of successful syncs
2. **Duration**: Average time per sync
3. **Error Rate**: % of failed syncs
4. **Error Types**: Categorize failures

### Alerts to Set Up

- Sync duration > 90 seconds
- Error rate > 10%
- No syncs in 24 hours
- Database errors

### Log Analysis

```bash
# Count successful syncs today
vercel logs --since=24h | grep "Successfully synced"

# Count failed syncs
vercel logs --since=24h | grep "Failed to connect"

# Average sync duration
vercel logs --since=24h | grep "eCrew Sync:" | awk '{sum+=$NF; count++} END {print sum/count}'
```

---

**Note**: This is a living document. Update as you discover new issues or solutions.