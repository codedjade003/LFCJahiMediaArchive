// app/api/media/stream/route.ts - For consumer preview
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { b2 } from "@/lib/b2";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const tokenFromQuery = url.searchParams.get("token");
    
    if (!id) {
      return NextResponse.json({ error: "Missing media id" }, { status: 400 });
    }

    // Token verification (same as download route)
    let token = tokenFromQuery;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "").trim();
      }
    }
    
    if (!token || token === "null" || token === "undefined") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    token = decodeURIComponent(token);
    
    let payload;
    try {
      payload = jwt.verify(token, process.env.COUPON_SECRET!) as { couponId: string };
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check coupon
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("id", payload.couponId)
      .single();
    
    if (!coupon || !coupon.redeemed) {
      return NextResponse.json({ error: "Invalid coupon" }, { status: 403 });
    }

    // Get media info
    const { data: media } = await supabase
      .from("media")
      .select("fileName, type, b2_file_info, original_filename")
      .eq("id", id)
      .single();
    
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Check coupon type access
    if (coupon.type !== 'all' && coupon.type !== media.type) {
      return NextResponse.json({ 
        error: `This coupon only provides access to ${coupon.type} files`
      }, { status: 403 });
    }

    // B2 authorization
    await b2.authorize();

    // Get B2 file ID
    let b2FileId = null;
    if (media.b2_file_info && typeof media.b2_file_info === 'object') {
      const fileInfo = media.b2_file_info as any;
      b2FileId = fileInfo.fileId || fileInfo.actualB2FileId || null;
    }

    // Get download authorization
    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID!,
      fileNamePrefix: media.fileName,
      validDurationInSeconds: 300,
    });

    if (!downloadAuth.data?.authorizationToken) {
      throw new Error("Failed to get authorization token");
    }

    // Construct B2 URL
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

    // Determine content type
    const fileExt = media.fileName.split('.').pop()?.toLowerCase();
    const isVideo = media.type === 'video' || ['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(fileExt || '');
    const contentType = getContentType(media.fileName, media.type);
    
    // For videos, stream with video headers
    if (isVideo) {
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=3600');
      // No Content-Disposition = browser shows video
      
      return new Response(response.body, {
        headers,
        status: 200
      });
    }

    // For images and audio, show in browser
    const fileBuffer = await response.arrayBuffer();
    
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=3600');
    // No Content-Disposition = browser displays content

    return new Response(fileBuffer, { headers });

  } catch (err) {
    console.error("Consumer stream error:", err);
    return NextResponse.json({ error: "Stream failed" }, { status: 500 });
  }
}

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
    'webp': 'image/webp'
  };
  
  const audioTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac'
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