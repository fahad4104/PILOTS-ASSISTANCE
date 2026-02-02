// Activity types
export type ActivityType = "LOGIN" | "APP_USAGE" | "REGISTRATION";

interface LogActivityParams {
  type: ActivityType;
  userId?: string;
  userName?: string;
  userEmail?: string;
  details?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await fetch("/api/activity/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch (error) {
    // Silent fail - don't break the app if logging fails
    console.error("Failed to log activity:", error);
  }
}

// Convenience functions
export function logLogin(userId: string, userName: string, userEmail: string) {
  return logActivity({
    type: "LOGIN",
    userId,
    userName,
    userEmail,
  });
}

export function logAppUsage(
  userId: string,
  userName: string,
  userEmail: string,
  appName: string
) {
  return logActivity({
    type: "APP_USAGE",
    userId,
    userName,
    userEmail,
    details: { appName },
  });
}

export function logRegistration(userName: string, userEmail: string) {
  return logActivity({
    type: "REGISTRATION",
    userName,
    userEmail,
  });
}
