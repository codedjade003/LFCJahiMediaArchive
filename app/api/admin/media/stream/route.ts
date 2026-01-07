// app/api/admin/media/stream/route.ts - STREAM ONLY (NO DOWNLOAD)
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
    
    if (!id) {
      return NextResponse.json({ error: "Missing media id" }, { status: 400 });
    }

    // Get media info - get original filename from database
    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("fileName, type, b2_file_info, original_filename")
      .eq("id", id)
      .single();
    
    if (mediaError || !media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Use original_filename if available, otherwise use fileName
    const displayName = media.original_filename || media.fileName;
    
    // Authorize with B2
    await b2.authorize();

    // Get B2 file ID from b2_file_info
    let b2FileId = null;
    if (media.b2_file_info && typeof media.b2_file_info === 'object') {
      const fileInfo = media.b2_file_info as any;
      b2FileId = fileInfo.fileId || fileInfo.actualB2FileId || null;
    }

    // Get download authorization for streaming
    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID!,
      fileNamePrefix: media.fileName, // Use stored filename for B2 lookup
      validDurationInSeconds: 300,
    });

    if (!downloadAuth.data?.authorizationToken) {
      throw new Error("Failed to get download authorization token");
    }

    // Construct the direct B2 URL
    let downloadUrl;
    if (b2FileId) {
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/b2api/v2/b2_download_file_by_id?fileId=${b2FileId}`;
    } else {
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/file/${process.env.B2_BUCKET_NAME}/${encodeURIComponent(media.fileName)}`;
    }

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': downloadAuth.data.authorizationToken
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
    }

    // Determine if it's a video for streaming
    const fileExt = media.fileName.split('.').pop()?.toLowerCase();
    const isVideo = media.type === 'video' || ['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(fileExt || '');
    
    const contentType = getContentType(media.fileName, media.type);
    
    // For videos, stream with proper video headers (NO DOWNLOAD PROMPT)
    if (isVideo) {
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=86400');
      // IMPORTANT: No Content-Disposition header = browser will show, not download
      
      return new Response(response.body, {
        headers,
        status: 200,
        statusText: 'OK'
      });
    }

    // For images and audio, also show in browser (no download)
    const fileBuffer = await response.arrayBuffer();

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=86400');
    // For images: browser will display
    // For audio: browser will show player if supported

    return new Response(fileBuffer, { headers });

  } catch (err) {
    console.error("Stream error:", err);
    return NextResponse.json({ error: "Stream failed" }, { status: 500 });
  }
}

// Helper function to get content type
function getContentType(fileName: string, fileType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const videoTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo'
  };
  
  const imageTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml'
  };
  
  const audioTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4'
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