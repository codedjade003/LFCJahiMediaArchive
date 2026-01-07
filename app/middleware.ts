// middleware.ts (in root of your project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
  // Only protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Skip middleware for login page
    if (request.nextUrl.pathname === '/admin/login') {
      return NextResponse.next();
    }
    
    // Check for admin token
    const token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      // Redirect to login if no token
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    
    try {
      // Verify JWT
      const secret = process.env.ADMIN_JWT_SECRET!;
      jwt.verify(token, secret);
      
      // Token is valid, allow access
      return NextResponse.next();
    } catch (err) {
      console.error('JWT verification failed:', err);
      
      // Clear invalid cookie and redirect to login
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin_token');
      return response;
    }
  }
  
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: '/admin/:path*',
};