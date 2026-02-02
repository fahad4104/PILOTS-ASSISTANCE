import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();

// This endpoint should be called by a cron job daily
// Vercel Cron: Add to vercel.json
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for required env vars
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Get yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Fetch all activities from yesterday
    const activities = await prisma.activityLog.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group activities by type
    const logins = activities.filter((a) => a.type === "LOGIN");
    const registrations = activities.filter((a) => a.type === "REGISTRATION");
    const appUsages = activities.filter((a) => a.type === "APP_USAGE");

    // Count unique users
    const uniqueLoginUsers = new Set(logins.map((l) => l.userId)).size;
    const uniqueAppUsers = new Set(appUsages.map((a) => a.userId)).size;

    // Count app usage by app name
    const appUsageByApp: Record<string, number> = {};
    appUsages.forEach((a) => {
      try {
        const details = a.details ? JSON.parse(a.details) : {};
        const appName = details.appName || "Unknown";
        appUsageByApp[appName] = (appUsageByApp[appName] || 0) + 1;
      } catch {
        appUsageByApp["Unknown"] = (appUsageByApp["Unknown"] || 0) + 1;
      }
    });

    // Format date for email
    const dateStr = yesterday.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to right, #2563eb, #1d4ed8); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .stat-box { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
    .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
    .stat-label { color: #64748b; font-size: 14px; }
    .section-title { font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e293b; }
    .user-list { background: white; padding: 10px; border-radius: 8px; max-height: 200px; overflow-y: auto; }
    .user-item { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .user-item:last-child { border-bottom: none; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✈️ Pilot Assistance</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Daily Activity Report</p>
    </div>

    <div class="content">
      <p><strong>Report Date:</strong> ${dateStr}</p>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
        <div class="stat-box">
          <div class="stat-number">${logins.length}</div>
          <div class="stat-label">Total Logins</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${uniqueLoginUsers}</div>
          <div class="stat-label">Unique Users</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${registrations.length}</div>
          <div class="stat-label">New Registrations</div>
        </div>
      </div>

      ${registrations.length > 0 ? `
      <div class="section-title">📝 New Registrations</div>
      <div class="user-list">
        ${registrations.map((r) => `
          <div class="user-item">
            <strong>${r.userName || "N/A"}</strong><br>
            <span style="color: #64748b; font-size: 13px;">${r.userEmail || "N/A"}</span>
          </div>
        `).join("")}
      </div>
      ` : ""}

      <div class="section-title">📱 App Usage</div>
      <div class="user-list">
        ${Object.entries(appUsageByApp).map(([app, count]) => `
          <div class="user-item">
            <strong>${app}</strong>
            <span style="float: right; background: #dbeafe; color: #1d4ed8; padding: 2px 10px; border-radius: 12px; font-size: 13px;">${count} uses</span>
          </div>
        `).join("") || "<p style='color: #64748b;'>No app usage recorded</p>"}
      </div>

      ${logins.length > 0 ? `
      <div class="section-title">🔐 Login Activity</div>
      <div class="user-list">
        ${logins.slice(0, 10).map((l) => `
          <div class="user-item">
            <strong>${l.userName || "N/A"}</strong>
            <span style="float: right; color: #64748b; font-size: 13px;">
              ${new Date(l.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        `).join("")}
        ${logins.length > 10 ? `<p style="color: #64748b; text-align: center; margin: 10px 0 0 0;">+${logins.length - 10} more logins</p>` : ""}
      </div>
      ` : ""}
    </div>

    <div class="footer">
      <p>This is an automated daily report from Pilot Assistance</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return NextResponse.json({ error: "ADMIN_EMAIL not configured" }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: "Pilot Assistance <reports@resend.dev>",
      to: adminEmail,
      subject: `📊 Daily Report - ${dateStr}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id,
      stats: {
        logins: logins.length,
        uniqueUsers: uniqueLoginUsers,
        registrations: registrations.length,
        appUsage: appUsages.length,
      },
    });
  } catch (error) {
    console.error("Error generating daily report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
