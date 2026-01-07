// app/admin/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return NextResponse.redirect(new URL('/admin/login', req.url));

  try {
    jwt.verify(token, process.env.ADMIN_SECRET!);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
}

export const config = {
  matcher: '/admin/:path*', // apply to all admin routes
};
