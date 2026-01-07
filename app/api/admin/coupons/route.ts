// app/api/admin/coupons/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// GET: Get all coupons with filters
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const redeemed = url.searchParams.get("redeemed");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    
    // Build query
    let query = supabase
      .from("coupons")
      .select("*", { count: "exact" });
    
    // Apply filters
    if (type && type !== "all") {
      query = query.eq("type", type);
    }
    
    if (redeemed === "true") {
      query = query.eq("redeemed", true);
    } else if (redeemed === "false") {
      query = query.eq("redeemed", false);
    }
    
    // Apply sorting
    query = query.order(sortBy as any, { ascending: sortOrder === "asc" });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: coupons, error, count } = await query;
    
    if (error) {
      console.error("Error fetching coupons:", error);
      return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
    }
    
    return NextResponse.json({
      coupons: coupons || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      totalPages: count ? Math.ceil(count / limit) : 0,
      limit,
      offset
    });
    
  } catch (err) {
    console.error("Get coupons error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch coupons", 
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST: Export coupons in different formats
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { format = 'json', filters = {} } = body;
    
    // Build query based on filters
    let query = supabase.from("coupons").select("*");
    
    if (filters.type && filters.type !== "all") {
      query = query.eq("type", filters.type);
    }
    
    if (filters.redeemed !== undefined) {
      query = query.eq("redeemed", filters.redeemed);
    }
    
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate);
    }
    
    const { data: coupons, error } = await query.order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching coupons for export:", error);
      return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
    }
    
    if (!coupons || coupons.length === 0) {
      return NextResponse.json({ 
        error: "No coupons found matching criteria" 
      }, { status: 404 });
    }
    
    let exportData;
    let contentType;
    let filename = `coupons_${new Date().toISOString().split('T')[0]}`;
    
    switch (format.toLowerCase()) {
      case 'csv':
        // Convert to CSV
        const csvHeaders = ['Code', 'Type', 'Redeemed', 'Expires At', 'Created At'];
        const csvRows = coupons.map(coupon => [
          `"${coupon.code}"`,
          `"${coupon.type}"`,
          `"${coupon.redeemed ? 'Yes' : 'No'}"`,
          `"${coupon.expires_at || 'Never'}"`,
          `"${new Date(coupon.created_at).toLocaleString()}"`
        ]);
        
        exportData = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
        contentType = 'text/csv';
        filename += '.csv';
        break;
        
      case 'excel':
        // For Excel, we'll return JSON that can be converted to Excel on frontend
        exportData = JSON.stringify(coupons, null, 2);
        contentType = 'application/json';
        filename += '.json';
        break;
        
      case 'txt':
        // Text format
        exportData = coupons.map(coupon => 
          `Coupon: ${coupon.code}\n` +
          `Type: ${coupon.type.toUpperCase()}\n` +
          `Redeemed: ${coupon.redeemed ? 'YES' : 'NO'}\n` +
          `Expires: ${coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'Never'}\n` +
          `Created: ${new Date(coupon.created_at).toLocaleString()}\n` +
          `${'='.repeat(40)}`
        ).join('\n\n');
        contentType = 'text/plain';
        filename += '.txt';
        break;
        
      default:
        // JSON format (default)
        exportData = JSON.stringify(coupons, null, 2);
        contentType = 'application/json';
        filename += '.json';
    }
    
    // Return as downloadable file
    return new Response(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (err) {
    console.error("Export coupons error:", err);
    return NextResponse.json({ 
      error: "Failed to export coupons", 
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}