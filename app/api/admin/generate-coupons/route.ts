import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: Request) {
  try {
    const { type, count = 1 } = await req.json();

    if (!["image", "video", "audio", "all"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid coupon type" },
        { status: 400 }
      );
    }

    const coupons = [];

    for (let i = 0; i < count; i++) {
      // Generate readable coupon codes like "ABC-123-DEF"
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.floor(100 + Math.random() * 900);
      const part3 = Math.random().toString(36).substring(2, 5).toUpperCase();
      const code = `${part1}-${part2}-${part3}`;

      coupons.push({
        code,
        type,
        // Optionally set expiration date
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });
    }

    const { error } = await supabase.from("coupons").insert(coupons);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      coupons,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to generate coupons" },
      { status: 500 }
    );
  }
}