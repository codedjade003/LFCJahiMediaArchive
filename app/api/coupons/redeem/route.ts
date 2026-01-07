import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Coupon code required" }, { status: 400 });
    }

    // Fetch coupon
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .single();

    if (error || !coupon) {
      return NextResponse.json({ error: "Invalid coupon" }, { status: 404 });
    }

    const now = new Date();

    // FIXED LOGIC: Check if already redeemed AND expired
    if (coupon.redeemed) {
      // Only check expiration if already redeemed
      if (coupon.expires_at) {
        const expiresDate = new Date(coupon.expires_at);
        if (now.getTime() > expiresDate.getTime()) {
          return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
        }
      }
      // If redeemed but not expired, continue to issue token
    } else {
      // Coupon not redeemed yet - mark it as redeemed and set expiration
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      const { error: updateError } = await supabase
        .from("coupons")
        .update({
          redeemed: true, // This changes from false to true
          redeemed_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", coupon.id);

      if (updateError) {
        console.error(updateError);
        return NextResponse.json({ error: "Failed to redeem coupon" }, { status: 500 });
      }

      // Update coupon object with new expiration
      coupon.expires_at = expiresAt.toISOString();
    }

    // Issue JWT access token (for both newly redeemed and already-redeemed-but-not-expired)
    const accessToken = jwt.sign(
      { couponId: coupon.id },
      process.env.COUPON_SECRET!,
      { expiresIn: "24h" }
    );

    return NextResponse.json({
      success: true,
      accessToken,
      expires_at: coupon.expires_at,
      type: coupon.type,
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Redeem failed" }, { status: 500 });
  }
}