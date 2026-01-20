// app/api/admin/delete-media/route.ts
import { NextResponse } from "next/server";
import { b2 } from "@/lib/b2";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

// Supabase service role client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function DELETE(req: Request) {
  try {
    // Check admin authentication
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    try {
      jwt.verify(token, process.env.ADMIN_JWT_SECRET!);
    } catch {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("id");
    const batchIds = searchParams.get("ids");

    if (!mediaId && !batchIds) {
      return NextResponse.json(
        { error: "No media ID(s) provided" },
        { status: 400 }
      );
    }

    // Authenticate with B2
    await b2.authorize();

    let mediaRecords;
    let idsToDelete: string[] = [];

    // Handle batch deletion
    if (batchIds) {
      idsToDelete = batchIds.split(",");
      const { data, error } = await supabase
        .from("media")
        .select("id, b2_file_id, fileName")
        .in("id", idsToDelete);

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to fetch media records" },
          { status: 500 }
        );
      }
      mediaRecords = data;
    } 
    // Handle single deletion
    else if (mediaId) {
      const { data, error } = await supabase
        .from("media")
        .select("id, b2_file_id, fileName")
        .eq("id", mediaId)
        .single();

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to fetch media record" },
          { status: 500 }
        );
      }
      mediaRecords = [data];
      idsToDelete = [mediaId];
    }

    if (!mediaRecords || mediaRecords.length === 0) {
      return NextResponse.json(
        { error: "No media found to delete" },
        { status: 404 }
      );
    }

    const results = {
      successful: [] as { id: string; fileName: string }[],
      failed: [] as { id: string; fileName: string; error: string }[]
    };

    // Delete each file from B2
    for (const record of mediaRecords) {
      try {
        if (!record.b2_file_id) {
          console.warn(`No B2 file ID for record ${record.id}, skipping B2 deletion`);
          continue;
        }

        await b2.deleteFileVersion({
          fileId: record.b2_file_id,
          fileName: record.fileName,
        });

        results.successful.push({
          id: record.id,
          fileName: record.fileName
        });
      } catch (error) {
        console.error(`Failed to delete file from B2: ${record.id}`, error);
        results.failed.push({
          id: record.id,
          fileName: record.fileName,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Delete records from Supabase for successful B2 deletions only
    const successfulIds = results.successful.map(r => r.id);
    if (successfulIds.length > 0) {
      const { error: dbError } = await supabase
        .from("media")
        .delete()
        .in("id", successfulIds);

      if (dbError) {
        console.error("Failed to delete from database:", dbError);
        // Don't fail the whole request if DB deletion fails for some records
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.successful.length} file(s)`,
      details: {
        successful: results.successful,
        failed: results.failed
      }
    });

  } catch (error) {
    console.error("Delete failed:", error);
    return NextResponse.json(
      { 
        error: "Delete failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}


