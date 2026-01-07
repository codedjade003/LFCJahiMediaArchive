import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const couponId = searchParams.get("couponId");

    if (!couponId) {
      return NextResponse.json({ error: "couponId required" }, { status: 400 });
    }

    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("id", couponId)
      .single();

    if (!coupon || !coupon.redeemed) {
      return NextResponse.json({ error: "Invalid coupon" }, { status: 403 });
    }

    if (new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: "Coupon expired" }, { status: 403 });
    }

    let mediaQuery = supabase.from("media").select("*");

    if (coupon.type !== "all") {
      mediaQuery = mediaQuery.eq("type", coupon.type);
    }

    const { data: media } = await mediaQuery;

    return NextResponse.json({ media });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}
