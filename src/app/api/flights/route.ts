import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch flights for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch flights' },
        { status: 500 }
      );
    }

    return NextResponse.json({ flights: data || [] });
  } catch (error) {
    console.error('Error fetching flights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create multiple flights
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, flights } = body;

    if (!userId || !flights || !Array.isArray(flights)) {
      return NextResponse.json(
        { error: 'Missing userId or flights array' },
        { status: 400 }
      );
    }

    // Add user_id to each flight
    const flightsWithUserId = flights.map(flight => ({
      user_id: userId,
      date: flight.date,
      flight_number: flight.flightNumber,
      departure: flight.departure,
      destination: flight.destination,
      departure_time: flight.departureTime,
      arrival_time: flight.arrivalTime,
      aircraft: flight.aircraft,
      co_pilot: flight.coPilot || null,
      status: flight.status || 'scheduled',
    }));

    const { data, error } = await supabase
      .from('flights')
      .insert(flightsWithUserId)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create flights' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, flights: data });
  } catch (error) {
    console.error('Error creating flights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a flight
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flightId = searchParams.get('flightId');

    if (!flightId) {
      return NextResponse.json(
        { error: 'Missing flightId' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('flights')
      .delete()
      .eq('id', flightId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete flight' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
