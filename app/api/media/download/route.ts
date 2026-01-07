// app/api/media/download/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { b2 } from "@/lib/b2";
import jwt from "jsonwebtoken";

// Use the same Supabase client as your coupon route
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const tokenFromQuery = url.searchParams.get("token");
    
    console.log("Download request for media ID:", id);
    
    if (!id) {
      return NextResponse.json({ error: "Missing media id" }, { status: 400 });
    }

    // Get token from either query param or header
    let token = tokenFromQuery;
    
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "").trim();
      }
    }
    
    if (!token || token === "null" || token === "undefined") {
      console.error("No valid token found");
      return NextResponse.json({ error: "Unauthorized - No token provided" }, { status: 401 });
    }
    
    // Decode if it was URL encoded
    token = decodeURIComponent(token);
    
    console.log("Token received (first 30 chars):", token.substring(0, 30) + "...");
    
    let payload;
    try {
      // Verify coupon token
      payload = jwt.verify(token, process.env.COUPON_SECRET!) as { couponId: string };
      console.log("Token payload verified:", payload);
    } catch (jwtError: any) {
      console.error("JWT verification failed:", jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return NextResponse.json({ 
          error: "Token expired",
          details: `Expired at: ${jwtError.expiredAt}`
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: "Unauthorized - Token verification failed",
        details: jwtError.message 
      }, { status: 401 });
    }

    // Check coupon in database
    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select("*")
      .eq("id", payload.couponId)
      .single();
    
    if (couponError || !coupon) {
      console.error("Coupon not found:", couponError);
      return NextResponse.json({ error: "Invalid coupon - not found in database" }, { status: 403 });
    }
    
    console.log("Coupon found:", {
      id: coupon.id,
      code: coupon.code,
      redeemed: coupon.redeemed,
      expires_at: coupon.expires_at,
      type: coupon.type
    });
    
    // IMPORTANT: Check both redeemed AND expiration
    if (!coupon.redeemed) {
      return NextResponse.json({ error: "Coupon not redeemed" }, { status: 403 });
    }
    
    // Check expiration in database
    const now = new Date();
    if (coupon.expires_at) {
      const expiresDate = new Date(coupon.expires_at);
      if (now.getTime() > expiresDate.getTime()) {
        console.error("Coupon expired in database:", {
          expires_at: coupon.expires_at,
          current_time: now.toISOString()
        });
        return NextResponse.json({ 
          error: "Coupon expired",
          expires_at: coupon.expires_at
        }, { status: 403 });
      }
    }

    console.log("Coupon validation passed, fetching media...");
    
    // Get media info from database - including b2_file_info
    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("fileName, type, b2_file_info")
      .eq("id", id)
      .single();
    
    if (mediaError || !media) {
      console.error("Media not found:", mediaError);
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    console.log("Media found:", {
      fileName: media.fileName,
      type: media.type,
      fileExt: media.fileName.split('.').pop()
    });
    
    // Check if coupon type allows this media type
    const couponType = coupon.type; // 'all', 'image', 'video', 'audio'
    const mediaType = media.type; // 'image', 'video', 'audio'
    
    if (couponType !== 'all' && couponType !== mediaType) {
      return NextResponse.json({ 
        error: `This coupon only provides access to ${couponType} files`,
        couponType,
        mediaType
      }, { status: 403 });
    }

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

    // For videos, we need to handle differently
    const fileExt = media.fileName.split('.').pop()?.toLowerCase() || '';
    const isVideo = media.type === 'video' || ['mp4', 'mkv', 'mov', 'webm', 'avi', 'mpg', 'mpeg'].includes(fileExt);
    
    if (isVideo) {
      console.log("Processing video file:", media.fileName);
      return await handleVideoDownload(media.fileName, b2FileId);
    } else {
      console.log("Processing regular file:", media.fileName);
      return await handleRegularDownload(media.fileName, media.type, b2FileId);
    }

  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ 
      error: "Download failed", 
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// Handle video downloads (streaming approach)
async function handleVideoDownload(fileName: string, b2FileId: string | null) {
  try {
    console.log("Getting download authorization for:", fileName);
    
    // Get download authorization
    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID!,
      fileNamePrefix: fileName,
      validDurationInSeconds: 3600, // 1 hour for videos
    });

    if (!downloadAuth.data?.authorizationToken) {
      throw new Error("Failed to get download authorization token");
    }

    console.log("Download authorization received");

    // Construct the direct B2 URL
    let downloadUrl;
    if (b2FileId) {
      // Use file ID if available (most reliable)
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/b2api/v2/b2_download_file_by_id?fileId=${b2FileId}`;
    } else {
      // Fallback to bucket path
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/file/${process.env.B2_BUCKET_NAME}/${encodeURIComponent(fileName)}`;
    }

    console.log("Video download URL:", downloadUrl);

    // For MKV files and large videos, redirect to B2 instead of proxying
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    
    // OPTION 1: Redirect directly to B2 (best for large files)
    if (fileExt === 'mkv' || fileExt === 'mp4' || fileExt === 'mov') {
      console.log("Redirecting to B2 for direct video download");
      const redirectUrl = `${downloadUrl}?Authorization=${encodeURIComponent(downloadAuth.data.authorizationToken)}`;
      
      return NextResponse.redirect(redirectUrl, 307); // 307 preserves method
    }

    // OPTION 2: Stream with proper headers
    console.log("Streaming video from B2...");
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': downloadAuth.data.authorizationToken
      }
    });

    if (!response.ok) {
      console.error("B2 fetch failed:", response.status, response.statusText);
      throw new Error(`B2 returned ${response.status}: ${response.statusText}`);
    }

    // Get video content type
    const contentType = getVideoContentType(fileName);
    
    console.log("Video content type:", contentType);
    
    // Create a readable stream for video
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache videos
    
    // Return the stream
    return new Response(response.body, {
      headers,
      status: 200,
      statusText: 'OK'
    });

  } catch (error: any) {
    console.error("Video download error:", error);
    throw error;
  }
}

// Handle regular downloads (images, audio, documents)
async function handleRegularDownload(fileName: string, fileType: string, b2FileId: string | null) {
  try {
    console.log("Getting download authorization for regular file:", fileName);
    
    // Get download authorization
    const downloadAuth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID!,
      fileNamePrefix: fileName,
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
      downloadUrl = `${process.env.B2_DOWNLOAD_URL}/file/${process.env.B2_BUCKET_NAME}/${encodeURIComponent(fileName)}`;
    }

    console.log("Regular download URL:", downloadUrl);

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
    const contentType = getContentType(fileName, fileType);

    console.log("File downloaded:", {
      size: fileBuffer.byteLength,
      contentType: contentType
    });

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Content-Length', fileBuffer.byteLength.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(fileBuffer, { headers });

  } catch (error: any) {
    console.error("Regular download error:", error);
    throw error;
  }
}

// Helper function to get video content type
function getVideoContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const videoTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mpg': 'video/mpeg',
    'mpeg': 'video/mpeg',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    '3gp': 'video/3gpp',
    'ts': 'video/mp2t'
  };

  return videoTypes[ext || ''] || 'application/octet-stream';
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