// app/api/get-media/route.ts - Include original_filename
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET() {
  try {
    const { data: media, error } = await supabase
      .from("media")
      .select("id, fileName, type, file_size, uploaded_at, b2_file_info, original_filename")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching media:", error);
      return NextResponse.json([], { status: 200 });
    }

    // Map response to include display name
    const mediaWithDisplayName = media.map(item => ({
      ...item,
      displayName: item.original_filename || item.fileName
    }));

    return NextResponse.json(mediaWithDisplayName);
  } catch (err) {
    console.error("Get media error:", err);
    return NextResponse.json([], { status: 200 });
  }
}