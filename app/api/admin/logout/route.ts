// app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    // Get the cookies from the request
    const cookieStore = await cookies();
    
    // Clear the admin session cookie
    cookieStore.delete("admin_session");
    
    // Additional security: clear any other related cookies
    cookieStore.delete("admin_token");
    cookieStore.delete("session");
    
    // Also clear any authorization headers cache
    const headers = new Headers();
    headers.set('Clear-Site-Data', '"cookies", "storage"');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    // Return success response with redirect
    return NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { 
        headers,
        status: 200 
      }
    );
    
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}

// Also add a GET route to check session
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("admin_session");
    
    return NextResponse.json({
      authenticated: !!session?.value,
      sessionExists: !!session
    });
    
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({
      authenticated: false,
      error: "Session check failed"
    }, { status: 500 });
  }
}