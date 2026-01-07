// app/api/admin/media/download/route.ts - FORCED DOWNLOAD
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { b2 } from "@/lib/b2";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    console.log("Admin download request for media ID:", id);
    
    if (!id) {
      return NextResponse.json({ error: "Missing media id" }, { status: 400 });
    }

    // Get media info - include original_filename
    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("fileName, type, b2_file_info, original_filename")
      .eq("id", id)
      .single();
    
    if (mediaError || !media) {
      console.error("Media not found:", mediaError);
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Use original_filename for download, fileName for B2 lookup
    const downloadFileName = media.original_filename || media.fileName;
    
    console.log("Media found:", {
      storedName: media.fileName,
      displayName: downloadFileName,
      type: media.type
    });
    
    // Authorize with B2
    console.log("Authorizing with B2...");
    await b2.authorize();
    console.log("B2 Authorization successful");

    // Get B2 file ID from b2_file_info
    let b2FileId = null;
    if (media.b2_file_info && typeof media.b2_file_info === 'object') {
      const fileInfo = media.b2_file_info as any;
      b2FileId = fileInfo.fileId || fileInfo.actualB2FileId || null;
      console.log("B2 File ID from database:", b2FileId);
    }

    // Get download authorization
    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID!,
      fileNamePrefix: media.fileName, // Use stored filename for B2 lookup
      validDurationInSeconds: 300,
    });

    if (!downloadAuth.data?.authorizationToken) {
      throw new Error("Failed to get download authorization token");
    }

    console.log("Download authorization received");

    // Construct the direct B2 URL
    let downloadUrl;
    if (b2FileId) {
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/b2api/v2/b2_download_file_by_id?fileId=${b2FileId}`;
    } else {
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/file/${process.env.B2_BUCKET_NAME}/${encodeURIComponent(media.fileName)}`;
    }

    console.log("B2 download URL:", downloadUrl);

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': downloadAuth.data.authorizationToken
      }
    });

    if (!response.ok) {
      console.error("B2 fetch failed:", response.status, response.statusText);
      throw new Error(`B2 returned ${response.status}: ${response.statusText}`);
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType = getContentType(downloadFileName, media.type);

    console.log("File downloaded:", {
      size: fileBuffer.byteLength,
      contentType: contentType,
      downloadName: downloadFileName
    });

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    // IMPORTANT: Content-Disposition with "attachment" forces download
  const originalFileName = media.original_filename || __filename;
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);
    headers.set('Content-Length', fileBuffer.byteLength.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(fileBuffer, { headers });

  } catch (err) {
    console.error("Admin download error:", err);
    return NextResponse.json({ 
      error: "Download failed", 
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// Helper function to get content type
function getContentType(fileName: string, fileType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  // Video types
  const videoTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mpg': 'video/mpeg',
    'mpeg': 'video/mpeg'
  };
  
  // Image types
  const imageTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  
  // Audio types
  const audioTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac'
  };

  if (fileType === 'video' && ext && videoTypes[ext]) {
    return videoTypes[ext];
  } else if (fileType === 'image' && ext && imageTypes[ext]) {
    return imageTypes[ext];
  } else if (fileType === 'audio' && ext && audioTypes[ext]) {
    return audioTypes[ext];
  }

  return 'application/octet-stream';
}