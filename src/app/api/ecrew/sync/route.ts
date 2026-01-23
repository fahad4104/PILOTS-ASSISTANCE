import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { scrapeEcrewScheduleWebix, EcrewFlight } from '@/lib/ecrew-scraper-webix';

const prisma = new PrismaClient();

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

    // Step 2: Save flights to database
    try {
      // Transform the scraped flights to match database schema
      // Filter out flights with missing required data
      const flightsToInsert = flights
        .filter((flight) => flight.date && flight.flightNumber)
        .map((flight) => ({
          user_id: userId,
          date: flight.date || new Date().toISOString().split('T')[0],
          flight_number: flight.flightNumber || 'UNKNOWN',
          departure: flight.departure || '',
          destination: flight.destination || '',
          departure_time: flight.departureTime || '',
          arrival_time: flight.arrivalTime || '',
          aircraft: flight.aircraft || '',
          status: flight.status || 'scheduled',
        }));

      console.log(`Filtered flights to insert: ${flightsToInsert.length} of ${flights.length}`);

      if (flightsToInsert.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No valid flights to save (missing date or flight number)',
          syncedCount: 0,
          scrapedFlights: flights,
        });
      }

      // Insert flights using Prisma
      const insertedFlights = await prisma.flight.createMany({
        data: flightsToInsert,
        skipDuplicates: true,
      });

      console.log(`Successfully saved ${insertedFlights.count} flights to database`);

      // Fetch the inserted flights to return
      const savedFlights = await prisma.flight.findMany({
        where: { user_id: userId },
        orderBy: { date: 'asc' },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully synced ${insertedFlights.count} flights from eCrew`,
        syncedCount: insertedFlights.count,
        flights: savedFlights,
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
