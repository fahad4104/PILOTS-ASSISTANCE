# Supabase Database Setup for Pilot Assistance

## Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Sign up with GitHub
3. Create a new project:
   - Project name: `pilot-assistance`
   - Database password: (create a strong password and save it)
   - Region: Choose closest to UAE (Middle East or Asia)

## Step 2: Get API Keys
After project creation:
1. Go to Project Settings → API
2. Copy these values:
   - `Project URL`: Your API URL
   - `anon public key`: Your public API key

## Step 3: Create Database Tables

Go to SQL Editor in Supabase and run this SQL:

```sql
-- Users table (for registered pilots)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  rank TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Flights/Roster table
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  flight_number TEXT NOT NULL,
  departure TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  aircraft TEXT NOT NULL,
  co_pilot TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_flights_user_id ON flights(user_id);
CREATE INDEX idx_flights_date ON flights(date);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can read their own flights"
  ON flights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flights"
  ON flights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flights"
  ON flights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flights"
  ON flights FOR DELETE
  USING (auth.uid() = user_id);
```

## Step 4: Add Environment Variables to Vercel

In your Vercel project settings, add:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Step 5: Install Supabase Client
Run this command locally:
```bash
npm install @supabase/supabase-js
```

## Step 6: Automatic eCrew Sync (Optional - Advanced)

The application includes an automatic sync feature that can extract roster data directly from eCrew website using user credentials. This feature is currently **in development** and requires additional setup:

### Requirements for Auto-Sync:
1. **Web Scraping Library**: Install Puppeteer or Playwright
   ```bash
   npm install puppeteer
   # or
   npm install playwright
   ```

2. **Implementation**: Update [src/app/api/ecrew/sync/route.ts](src/app/api/ecrew/sync/route.ts) with:
   - Login automation to eCrew website
   - Navigation to roster page
   - Data extraction from the roster table
   - Parsing and formatting the data

3. **Security Considerations**:
   - User credentials are NOT stored in the database
   - Credentials are only used temporarily for the sync request
   - Consider implementing encryption for credentials in transit
   - Add rate limiting to prevent abuse

4. **Alternative Approach**:
   - If eCrew provides an official API, use that instead of web scraping
   - Contact eCrew technical support for API documentation

### Current Status:
- ✅ UI for auto-sync is implemented
- ✅ API endpoint created
- ⏳ Web scraping logic needs implementation
- ⏳ Testing with real eCrew website needed

For now, users can use the **Manual CSV Upload** method which is fully functional.
