import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.match(/admin_token=([^;]+)/)?.[1];

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    jwt.verify(token, process.env.ADMIN_JWT_SECRET!);
    return NextResponse.json({ authorized: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
