import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    console.log("=== Access API Called ===");
    const auth = req.headers.get("authorization");
    console.log("Auth header exists:", !!auth);
    
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = auth.replace("Bearer ", "");
    
    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, process.env.COUPON_SECRET!) as { couponId: string };
      console.log("JWT payload:", payload);
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch coupon
    console.log("Fetching coupon with ID:", payload.couponId);
    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select("*")
      .eq("id", payload.couponId)
      .single();

    console.log("Coupon fetched:", coupon);
    console.log("Coupon error:", couponError);

    if (!coupon || !coupon.redeemed) {
      console.log("Coupon invalid or not redeemed");
      return NextResponse.json({ error: "Invalid coupon" }, { status: 403 });
    }

    // Check expiration
    const now = new Date();
    console.log("Current time (UTC):", now.toISOString());
    
    if (coupon.expires_at) {
      const expiresDate = new Date(coupon.expires_at);
      console.log("Coupon expires at (UTC):", coupon.expires_at);
      console.log("Expires date object:", expiresDate.toISOString());
      
      if (now.getTime() > expiresDate.getTime()) {
        console.log("Coupon expired! Now:", now.getTime(), "Expires:", expiresDate.getTime());
        return NextResponse.json({ error: "Coupon expired" }, { status: 403 });
      }
    }

    console.log("Coupon type:", coupon.type);
    
    // Query media - ADD original_filename to the select!
    console.log("Querying media table...");
    let query = supabase.from("media").select("id, fileName, type, original_filename, file_size, created_at"); // ADDED original_filename
    
    if (coupon.type !== "all") {
      console.log(`Filtering by type: ${coupon.type}`);
      query = query.eq("type", coupon.type);
    }
    
    const { data: media, error: mediaError } = await query;
    console.log("Media query result:", media);
    console.log("Media error:", mediaError);
    console.log("Media count:", media?.length || 0);

    if (mediaError) {
      console.error("Database error:", mediaError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Always return media array, even if empty
    return NextResponse.json({ media: media || [] });

  } catch (err) {
    console.error("Unexpected error in Access API:", err);
    return NextResponse.json({ error: "Access denied" }, { status: 401 });
  }
}