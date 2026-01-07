import { NextResponse } from "next/server";
import { b2 } from "@/lib/b2";

export async function POST(req: Request) {
  try {
    const { fileName, expiresIn = 3600 } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: "Missing file name" }, { status: 400 });
    }

    await b2.authorize();

    const auth = await b2.getDownloadAuthorization({
      bucketId: process.env.B2_BUCKET_ID!,
      fileNamePrefix: fileName,
      validDurationInSeconds: expiresIn,
    });

    const signedUrl =
      `https://f000.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileName}` +
      `?Authorization=${auth.data.authorizationToken}`;

    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
