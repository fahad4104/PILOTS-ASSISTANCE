# eCrew Auto Sync Feature

## Overview
The eCrew Auto Sync feature allows pilots to automatically import their flight schedules from Etihad's eCrew portal directly into the Pilot Assistance system using web scraping with Puppeteer.

## Features
- ✅ Automatic login to eCrew portal
- ✅ Navigate to My Schedule page
- ✅ Extract flight data from schedule table
- ✅ Save flights to Supabase database
- ✅ Secure credential handling (not stored)
- ✅ Error handling and logging

## How It Works

### Technical Flow
1. **User Input**: Pilot enters eCrew credentials on the import page
2. **Puppeteer Launch**: Headless browser is launched with appropriate configuration
3. **Login**: Automated login to `https://ecrew.etihad.ae/ecrew`
4. **Navigation**: Navigate to the schedule/roster page
5. **Data Extraction**: Parse the HTML table to extract flight information
6. **Database Save**: Store flights in Supabase `flights` table
7. **Cleanup**: Browser is closed and resources are freed

### Architecture

```
src/
├── lib/
│   ├── ecrew-scraper.ts      # Main scraper class with EcrewScraper
│   ├── puppeteer-config.ts   # Browser configuration for dev/prod
│   └── supabase.ts           # Supabase client and types
└── app/
    ├── api/
    │   └── ecrew/
    │       └── sync/
    │           └── route.ts  # API endpoint for sync
    └── roster/
        └── import/
            └── page.tsx      # UI for manual/auto import
```

## Files Created/Modified

### New Files
1. **`src/lib/ecrew-scraper.ts`**
   - `EcrewScraper` class with methods:
     - `initialize()`: Setup browser
     - `login(credentials)`: Login to eCrew
     - `navigateToSchedule()`: Go to schedule page
     - `extractFlights()`: Parse flight data
     - `close()`: Cleanup browser
   - `scrapeEcrewSchedule()`: Main function to orchestrate scraping

2. **`src/lib/puppeteer-config.ts`**
   - Browser configuration for different environments
   - Production/Vercel optimized settings
   - Development settings

### Modified Files
1. **`src/app/api/ecrew/sync/route.ts`**
   - Updated from placeholder to full implementation
   - Integrates scraper with API endpoint
   - Saves data to Supabase

2. **`src/app/roster/import/page.tsx`**
   - Updated warning message
   - Already had UI for auto sync

## Database Schema

The flights are saved to the `flights` table in Supabase:

```typescript
type Flight = {
  id: string;
  user_id: string;
  date: string;
  flight_number: string;
  departure: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  aircraft: string;
  co_pilot?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at?: string;
};
```

## Usage

### For End Users
1. Navigate to Roster page
2. Click "Import Roster"
3. Select "Auto Sync" tab
4. Enter eCrew credentials
5. Click "Sync Roster"
6. Preview imported flights
7. Confirm import

### API Endpoint

**POST** `/api/ecrew/sync`

**Request Body:**
```json
{
  "userId": "user-id-string",
  "ecrewEmail": "pilot@etihad.ae",
  "ecrewPassword": "password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully synced X flights from eCrew",
  "syncedCount": 15,
  "flights": [...]
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Dependencies

Added to `package.json`:
```json
{
  "dependencies": {
    "puppeteer": "^latest"
  }
}
```

## Environment Configuration

The scraper uses configuration from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

For production (Vercel), additional configuration may be needed:
- Chrome/Chromium binary path
- Memory and timeout settings

## Deployment Notes

### Vercel Deployment
Puppeteer requires special configuration on Vercel:

1. **Add Chrome Binary**: May need to add `chrome-aws-lambda` or similar package
2. **Memory Limits**: Ensure sufficient memory allocation
3. **Timeout**: API routes may need extended timeout

### Alternative: External Service
For production, consider using a dedicated service like:
- BrowserStack
- Selenium Grid
- Puppeteer-as-a-Service

## Security Considerations

1. **Credentials**: NOT stored - used only for single sync session
2. **HTTPS**: All communication uses secure connections
3. **Input Validation**: Email and password validated
4. **Error Messages**: Generic errors to prevent information leakage
5. **Rate Limiting**: Consider adding to prevent abuse

## Limitations & Known Issues

1. **eCrew Structure**: The scraper uses generic selectors that may need adjustment based on actual eCrew HTML structure
2. **Authentication**: May need updates if eCrew changes login flow
3. **CAPTCHA**: If eCrew adds CAPTCHA, will need alternative approach
4. **Performance**: Web scraping is slower than API integration
5. **Maintenance**: Requires updates if eCrew website changes

## Customization

To adjust for actual eCrew structure:

1. **Login Selectors**: Update in `login()` method
2. **Schedule Navigation**: Update in `navigateToSchedule()` method
3. **Data Extraction**: Update in `extractFlights()` method
4. **Table Structure**: Adjust column indices in `extractFlights()`

## Testing

Before production use:

1. Test with real eCrew credentials (in development)
2. Verify data extraction accuracy
3. Test error handling (wrong credentials, network issues)
4. Test on Vercel/production environment
5. Monitor logs for any issues

## Future Enhancements

- [ ] Add scheduling for automatic daily sync
- [ ] Add sync status tracking
- [ ] Add selective sync (date range)
- [ ] Add conflict resolution for duplicate flights
- [ ] Add sync history/audit log
- [ ] Add email notifications for sync results
- [ ] Add support for other airlines' crew portals

## Troubleshooting

### Common Issues

**Issue**: Browser fails to launch
- Check Puppeteer installation
- Verify Chrome/Chromium binary path
- Check memory limits

**Issue**: Login fails
- Verify credentials are correct
- Check if eCrew changed login page
- Check for CAPTCHA or 2FA

**Issue**: No flights extracted
- Verify schedule page structure
- Check table selectors
- Add screenshots for debugging

**Issue**: Supabase insert fails
- Check database schema matches
- Verify user_id is valid
- Check data format (dates, times)

## Support

For issues or questions:
1. Check logs in browser console and server logs
2. Review error messages in API response
3. Use screenshot feature for debugging: `await scraper.takeScreenshot('debug.png')`

## License

Part of the Pilot Assistance project.