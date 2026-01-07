// app/api/upload/route.ts - WITH ORIGINAL FILENAME STORAGE & RETRY LOGIC
import { NextResponse } from "next/server";
import { b2 } from "@/lib/b2";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sanitizeFileName } from "@/lib/utils"; // You'll need to create this utility

// Supabase service role client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// Utility function to sanitize filename for B2 (create in lib/utils.ts)
// export function sanitizeFileName(filename: string): string {
//   return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
// }

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file size
    const maxSize = 100 * 1024 * 1024; // 100MB max
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 100MB limit" },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowedExtensions = [
      // Images
      "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg",
      // Videos
      "mp4", "mkv", "mov", "webm", "avi", "mpg", "mpeg",
      // Audio
      "mp3", "wav", "ogg", "flac", "m4a", "aac"
    ];
    
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Categorize file by extension
    let type: "video" | "audio" | "image" = "image";
    if (["mp4", "mkv", "mov", "webm", "avi", "mpg", "mpeg"].includes(ext)) type = "video";
    else if (["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(ext)) type = "audio";

    console.log("Authorizing with B2...");
    await b2.authorize();
    console.log("B2 Authorization successful");

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalFileName = file.name;
    
    // Sanitize filename for B2 storage
    const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const b2FileName = `${randomUUID()}-${sanitizedFileName}`;

    // RETRY LOGIC IMPLEMENTATION
    const maxRetries = 5;
    let lastError: any = null;
    let successfulUploadData: any = null;
    let successfulFileId: string | null = null;
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}: Getting upload URL...`);
        
        // Get fresh upload URL for each attempt (REQUIRED by B2 for retries)
        const uploadUrlResponse = await b2.getUploadUrl({
          bucketId: process.env.B2_BUCKET_ID!,
        });

        if (!uploadUrlResponse.data.uploadUrl || !uploadUrlResponse.data.authorizationToken) {
          throw new Error("Invalid upload URL response from B2");
        }

        const { uploadUrl, authorizationToken } = uploadUrlResponse.data;

        console.log(`Attempt ${attempt}: Uploading to ${uploadUrl}...`);
        
        // Attempt upload with fresh credentials
        const uploadResult = await b2.uploadFile({
          uploadUrl,
          uploadAuthToken: authorizationToken,
          fileName: b2FileName, // Use the sanitized B2 filename
          data: buffer,
          mime: file.type,
        });

        console.log(`Attempt ${attempt}: Upload successful!`);
        successfulUploadData = uploadResult.data;
        // fileId comes back from the upload API result, not the getUploadUrl call
        successfulFileId = String(uploadResult.data?.fileId ?? uploadResult.data?.fileID ?? "");
        attemptsUsed = attempt;
        break; // Exit retry loop on success
        
      } catch (error: any) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);

        // Check if this is a retryable error (DNS/network issues)
        const isRetryableError = 
          error.code === 'EAI_AGAIN' ||
          error.message?.includes('getaddrinfo') ||
          error.message?.includes('ENOTFOUND') ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ECONNRESET') ||
          (error.response && error.response.status >= 500);

        if (isRetryableError && attempt < maxRetries) {
          // Exponential backoff: wait longer between each retry
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          console.log(`Waiting ${delayMs}ms before next retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        } else if (isRetryableError && attempt === maxRetries) {
          // Out of retries for network issues
          throw new Error(`Upload failed after ${maxRetries} attempts due to persistent network issues: ${error.message}`);
        } else {
          // Non-retryable error (e.g., 400 Bad Request, auth issues)
          throw error;
        }
      }
    }

    if (!successfulFileId) {
      throw new Error("Upload failed: No successful upload after retries");
    }

    console.log("B2 upload successful, file ID:", successfulFileId);
    
    // Construct file info from what we know
    const b2FileInfo = {
      contentLength: file.size,
      contentType: file.type,
      uploadTimestamp: Date.now(),
      fileId: successfulFileId,
      fileName: b2FileName,
      originalFileName: originalFileName, // Store original name
      ...(successfulUploadData || {})
    };

    // Ensure file.size is a number
    const fileSize = Number(file.size);
    
    if (isNaN(fileSize) || fileSize <= 0) {
      console.error("Invalid file size:", file.size);
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }

    console.log("Saving to database...");
    const { data, error: dbError } = await supabase
      .from("media")
      .insert([{ 
        fileName: b2FileName, // Sanitized name for B2 operations
        original_filename: originalFileName, // Original name for display
        type,
        file_size: fileSize,
        b2_file_id: successfulFileId,
        b2_file_info: b2FileInfo,
        uploaded_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      // Try to delete from B2 since DB insert failed
      try {
        await b2.deleteFileVersion({
          fileId: successfulFileId,
          fileName: b2FileName,
        });
        console.log("Cleaned up B2 file after DB failure");
      } catch (cleanupError) {
        console.error("Failed to cleanup B2 file:", cleanupError);
      }
      throw dbError;
    }

    console.log("Upload complete:", {
      b2FileName,
      originalFileName,
      fileId: data.id
    });
    
    return NextResponse.json({ 
      success: true, 
      fileName: b2FileName,
      originalFileName,
      fileId: data.id,
      fileSize: fileSize,
      fileType: type,
      b2FileId: successfulFileId,
      attemptsUsed
    });
    
  } catch (error: any) {
    console.error("Upload failed:", error);
    
    let errorMessage = "Upload failed";
    let statusCode = 500;
    
    if (error.message?.includes("persistent network issues")) {
      errorMessage = "Storage service temporarily unavailable. Please try again.";
      statusCode = 503;
    } else if (error.response?.status === 400) {
      errorMessage = "Bad request to storage service";
      statusCode = 400;
    } else if (error.message?.includes("ENOTFOUND") || error.message?.includes("EAI_AGAIN")) {
      errorMessage = "Network error connecting to storage service";
      statusCode = 503;
    } else if (error.message?.includes("401") || error.message?.includes("unauthorized")) {
      errorMessage = "Storage service authorization failed";
      statusCode = 503;
    } else if (error.message?.includes("File size")) {
      errorMessage = error.message;
      statusCode = 400;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : "Unknown error",
      responseData: error.response?.data || "No response data"
    }, { status: statusCode });
  }
}