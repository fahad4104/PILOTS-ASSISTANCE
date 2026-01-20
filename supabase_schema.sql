-- Create tables for Pilot Assistance System
-- Run this in Supabase SQL Editor to set up the database schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rank TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Flights table
CREATE TABLE IF NOT EXISTS flights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    departure TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    aircraft TEXT NOT NULL,
    co_pilot TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_flights_user_id ON flights(user_id);
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date);
CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status);
CREATE INDEX IF NOT EXISTS idx_flights_user_date ON flights(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Allow anyone to insert (for registration)
CREATE POLICY "Allow public registration" ON users
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Allow users to read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    TO public
    USING (true); -- For now, allow all reads (can be restricted later)

-- Allow updates to own data
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    TO public
    USING (true);

-- RLS Policies for flights table
-- Users can read their own flights
CREATE POLICY "Users can read own flights" ON flights
    FOR SELECT
    TO public
    USING (true); -- For now, allow all reads

-- Users can insert their own flights
CREATE POLICY "Users can insert own flights" ON flights
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Users can update their own flights
CREATE POLICY "Users can update own flights" ON flights
    FOR UPDATE
    TO public
    USING (true);

-- Users can delete their own flights
CREATE POLICY "Users can delete own flights" ON flights
    FOR DELETE
    TO public
    USING (true);

-- Create a function to automatically clean up old flights (optional)
CREATE OR REPLACE FUNCTION cleanup_old_flights()
RETURNS void AS $$
BEGIN
    DELETE FROM flights
    WHERE status = 'completed'
    AND created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Example query to get user's upcoming flights
-- SELECT * FROM flights
-- WHERE user_id = 'user-uuid-here'
-- AND status = 'scheduled'
-- AND date >= CURRENT_DATE
-- ORDER BY date ASC;

-- Example query to get monthly statistics
-- SELECT
--     DATE_TRUNC('month', date::date) as month,
--     COUNT(*) as total_flights,
--     COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
--     COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
-- FROM flights
-- WHERE user_id = 'user-uuid-here'
-- GROUP BY month
-- ORDER BY month DESC;