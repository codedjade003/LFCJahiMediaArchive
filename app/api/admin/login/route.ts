// app/api/admin/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const base64Hash = process.env.ADMIN_HASHED_PASSWORD_BASE64;
    const secret = process.env.ADMIN_JWT_SECRET;

    if (!base64Hash || !secret) {
      console.error("Missing env vars:", { 
        hasBase64Hash: !!base64Hash, 
        hasSecret: !!secret 
      });
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // DEBUG: Show what we're working with
    console.log("Base64 hash from env (length):", base64Hash.length);
    console.log("First 50 chars:", base64Hash.substring(0, 50));
    
    try {
      // Decode Base64 back to the original bcrypt hash
      const decoded = Buffer.from(base64Hash, 'base64').toString('utf-8');
      
      console.log("Decoded hash length:", decoded.length);
      console.log("First 60 chars of decoded:", decoded.substring(0, 60));
      
      // Verify it looks like a bcrypt hash
      if (!decoded.startsWith('$2a$') && !decoded.startsWith('$2b$')) {
        console.error("Decoded hash doesn't look like bcrypt:", decoded.substring(0, 10));
        return NextResponse.json({ error: "Invalid hash format" }, { status: 500 });
      }
      
      // Compare password
      console.log("Comparing password...");
      console.log("Input password length:", password.length);
      
      const valid = await bcrypt.compare(password, decoded);
      console.log("Password comparison result:", valid);
      
      if (!valid) {
        // Optional: Test with a known bad password for debugging
        console.log("Testing with wrong password for comparison...");
        const wrongValid = await bcrypt.compare("wrongpassword", decoded);
        console.log("Wrong password test result:", wrongValid);
        
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      // Generate JWT
      const token = jwt.sign({ admin: true }, secret, { expiresIn: "8h" });

      const response = NextResponse.json({ 
        success: true, 
        message: "Login successful" 
      });

      // Set cookie
      response.cookies.set({
        name: "admin_token",
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
      });

      return response;
      
    } catch (decodeErr: any) {
      console.error("Base64 decode error:", decodeErr);
      return NextResponse.json({ 
        error: "Hash decode error",
        details: decodeErr.message 
      }, { status: 500 });
    }
    
  } catch (err: any) {
    console.error("Login error details:", err);
    return NextResponse.json({ 
      error: "Internal server error",
      details: err.message 
    }, { status: 500 });
  }
}