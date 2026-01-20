# Deployment Guide for eCrew Auto Sync

## Prerequisites

1. Vercel account
2. Supabase project
3. eCrew credentials for testing

## Step 1: Supabase Setup

### 1.1 Create Tables

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase_schema.sql`
4. Run the SQL script

### 1.2 Get Credentials

1. Go to Project Settings → API
2. Copy:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anonymous/Public Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Step 2: Vercel Deployment

### 2.1 Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2.2 Configure Environment Variables

Add these to your Vercel project settings:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Admin (if used)
ADMIN_SECRET=your-admin-secret

# OpenAI (if used)
OPENAI_API_KEY=your-openai-key

# Other existing variables
DATABASE_URL=your-database-url
POSTGRES_URL=your-postgres-url
```

### 2.3 Puppeteer Configuration for Vercel

Vercel has limitations with Puppeteer. You have two options:

#### Option A: Use Puppeteer Core with chrome-aws-lambda (Recommended)

Install additional package:
```bash
npm install chrome-aws-lambda puppeteer-core
```

Update `src/lib/puppeteer-config.ts`:

```typescript
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

export async function createBrowser() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
  }

  // Development
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
}
```

#### Option B: Use External Puppeteer Service

Services like:
- Browserless.io
- Apify
- ScrapingBee

Example with Browserless:

```typescript
export async function createBrowser() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && process.env.BROWSERLESS_API_KEY) {
    return await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`,
    });
  }

  // Local development
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
}
```

### 2.4 Deploy to Vercel

#### Via GitHub (Recommended)

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables
6. Deploy

#### Via Vercel CLI

```bash
cd c:\Users\faua\pilot-assistance
vercel
```

Follow the prompts and ensure environment variables are set.

## Step 3: Post-Deployment Configuration

### 3.1 Verify Environment Variables

```bash
vercel env ls
```

### 3.2 Test the Deployment

1. Visit your deployed URL
2. Register/login
3. Go to Roster → Import
4. Try Auto Sync with test credentials

### 3.3 Monitor Logs

```bash
vercel logs
```

Or check in Vercel Dashboard → Deployments → [Your Deployment] → Functions

## Step 4: Troubleshooting

### Issue: Puppeteer fails to launch

**Solution**: Use `chrome-aws-lambda` (Option A) or external service (Option B)

### Issue: Timeout errors

**Solution**: Increase function timeout in `vercel.json`:

```json
{
  "functions": {
    "src/app/api/ecrew/sync/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### Issue: Memory limit exceeded

**Solution**: Upgrade Vercel plan or use external browser service

### Issue: eCrew login fails

**Possible causes**:
- Wrong credentials
- eCrew website changed structure
- CAPTCHA or 2FA enabled
- Rate limiting

**Debug steps**:
1. Check API logs
2. Test locally first
3. Use screenshot feature to debug
4. Verify selectors match eCrew website

## Step 5: Production Considerations

### 5.1 Rate Limiting

Add rate limiting to prevent abuse:

```bash
npm install @upstash/ratelimit @upstash/redis
```

### 5.2 Queue System

For better reliability, use a queue:

```bash
npm install bull
```

### 5.3 Monitoring

Set up monitoring with:
- Vercel Analytics
- Sentry for error tracking
- Custom logging to external service

### 5.4 Caching

Cache successful syncs to reduce load:

```typescript
// Example with Redis
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Cache sync result
await redis.set(`sync:${userId}`, flights, { ex: 3600 }); // 1 hour
```

### 5.5 Security Enhancements

1. Add request signing
2. Implement retry logic with exponential backoff
3. Add IP whitelisting (if needed)
4. Log all sync attempts for audit

## Step 6: Alternative Deployment (Docker)

If Puppeteer issues persist on Vercel, consider:

### Using Railway/Render

1. Create `Dockerfile`:

```dockerfile
FROM node:18

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 3000
CMD ["npm", "start"]
```

2. Deploy to Railway or Render
3. Set environment variables
4. Deploy

## Step 7: Testing Checklist

Before going live:

- [ ] Test user registration
- [ ] Test user login
- [ ] Test manual CSV import
- [ ] Test eCrew auto sync with valid credentials
- [ ] Test error handling with invalid credentials
- [ ] Test with multiple concurrent requests
- [ ] Verify database writes
- [ ] Check API response times
- [ ] Review error logs
- [ ] Test on mobile devices

## Step 8: Maintenance

### Regular Tasks

1. **Weekly**: Check error logs
2. **Monthly**: Review sync success rate
3. **As needed**: Update selectors if eCrew changes
4. **Quarterly**: Review and clean old data

### Monitoring Metrics

- Sync success rate
- Average sync duration
- Error rate by type
- API response times
- Database query performance

## Support

For deployment issues:

1. Check Vercel logs: `vercel logs`
2. Review [Vercel Puppeteer Guide](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-on-aws-lambda)
3. Check [Next.js API Routes Docs](https://nextjs.org/docs/api-routes/introduction)
4. Review Supabase connection issues

## Cost Estimates

### Free Tier (Development)

- Vercel: Hobby plan (free)
- Supabase: Free tier (500MB database)
- Puppeteer: Local/free

### Production (Recommended)

- Vercel: Pro ($20/month) - needed for longer function timeouts
- Supabase: Pro ($25/month) - better performance
- Browserless: Starting at $25/month - if using external service

**Alternative**: Deploy to Railway/Render with Docker for better Puppeteer support at similar costs.