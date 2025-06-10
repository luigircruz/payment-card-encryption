import type { ErrorResponse, PublicKeyResponse } from "@/types/payment";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export async function GET(): Promise<
  NextResponse<PublicKeyResponse | ErrorResponse>
> {
  try {
    const publicKeyPath = path.join(process.cwd(), "public_key.pem");
    const key = await fs.readFile(publicKeyPath, "utf-8");
    return NextResponse.json({ key });
  } catch (error: unknown) {
    console.error("Could not read public key:", error);
    return NextResponse.json(
      { error: "Could not provide encryption key." },
      { status: 500 }
    );
  }
}
