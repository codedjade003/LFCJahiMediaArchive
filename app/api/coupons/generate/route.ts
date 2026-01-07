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
      const code = randomUUID().split("-")[0].toUpperCase();

      coupons.push({
        code,
        type,
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
