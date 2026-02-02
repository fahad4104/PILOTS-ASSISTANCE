import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, userId, userName, userEmail, details } = body;

    // Get IP and user agent from headers
    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const activity = await prisma.activityLog.create({
      data: {
        type,
        userId,
        userName,
        userEmail,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ success: true, id: activity.id });
  } catch (error) {
    console.error("Error logging activity:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log activity" },
      { status: 500 }
    );
  }
}
