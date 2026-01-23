import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeEcrewScheduleWebix, EcrewFlight } from '@/lib/ecrew-scraper-webix';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ecrewEmployeeId, ecrewPassword } = body;

    if (!userId || !ecrewEmployeeId || !ecrewPassword) {
      return NextResponse.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    console.log(`Starting eCrew sync for user: ${userId}`);

    // Step 1: Scrape eCrew schedule using Puppeteer with Webix support
    let flights: EcrewFlight[];
    try {
      flights = await scrapeEcrewScheduleWebix({
        employeeId: ecrewEmployeeId,
        password: ecrewPassword,
      });

      console.log(`Successfully scraped ${flights.length} flights from eCrew`);

      if (flights.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No flights found in eCrew schedule',
          syncedCount: 0,
        });
      }
    } catch (scrapeError) {
      console.error('eCrew scraping error:', scrapeError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to eCrew',
          details: scrapeError instanceof Error ? scrapeError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Step 2: Save flights to Supabase
    try {
      // First, delete existing flights for this user (optional - you might want to keep old data)
      // Uncomment the following if you want to clear old flights before syncing
      // const { error: deleteError } = await supabase
      //   .from('flights')
      //   .delete()
      //   .eq('user_id', userId);
      //
      // if (deleteError) {
      //   console.error('Error deleting old flights:', deleteError);
      // }

      // Transform the scraped flights to match Supabase schema
      const flightsToInsert = flights.map((flight) => ({
        user_id: userId,
        date: flight.date,
        flight_number: flight.flightNumber,
        departure: flight.departure,
        destination: flight.destination,
        departure_time: flight.departureTime,
        arrival_time: flight.arrivalTime,
        aircraft: flight.aircraft,
        status: flight.status,
      }));

      // Insert flights into Supabase
      const { data, error: insertError } = await supabase
        .from('flights')
        .insert(flightsToInsert)
        .select();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to save flights to database',
            details: insertError.message,
          },
          { status: 500 }
        );
      }

      console.log(`Successfully saved ${data?.length || 0} flights to Supabase`);

      return NextResponse.json({
        success: true,
        message: `Successfully synced ${data?.length || 0} flights from eCrew`,
        syncedCount: data?.length || 0,
        flights: data,
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Database operation failed',
          details: dbError instanceof Error ? dbError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('eCrew sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
