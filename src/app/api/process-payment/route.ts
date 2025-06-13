import type { EncryptedCardPayload, ErrorResponse } from "@/types/payment";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

interface SuccessResponse {
  message: string;
}

// Assume these are your variables
const amount = "1.10";
const merchantID = "metromarttech_Dev";
const referenceNumber = "user-12345";
const verifykey = "366e26f4e3163c7e458a48b06da0fd59"; // This should be an environment variable!

// 1. Concatenate the strings in the exact same order.
const stringToHash = `${amount}${merchantID}${referenceNumber}${verifykey}`;

const signature = createHash("md5").update(stringToHash).digest("hex");

export async function POST(
  request: Request
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const payload: EncryptedCardPayload = await request.json();
    if (!payload) {
      return NextResponse.json({ error: "Missing payload." }, { status: 400 });
    }

    console.log({ payload, signature });

    const requestData = {
      MerchantID: merchantID,
      ReferenceNo: referenceNumber,
      TxnType: "SALS",
      TxnChannel: "CREDITAN",
      TxnCurrency: "PHP",
      TxnAmount: amount,
      Signature: signature,
      CustName: "RMS Demo",
      CustEmail: "demo@RMS.com",
      CustContact: "09378829882",
      CustDesc: "testing by RMS",
      ReturnURL: "http://localhost:3000/fiuu/payments/success",
      FailedURL: "http://localhost:3000/fiuu/payments/failed",
      NotificationURL:
        "http://localhost:3000/api/v2/fiuu/webhooks/notification-url",
      CallbackURL: "http://localhost:3000/api/v2/fiuu/webhooks/callback-url",
      ...payload,
    };

    const formData = new FormData();
    for (const [key, value] of Object.entries(requestData)) {
      // This check prevents sending fields with null or undefined values
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }

    const fiuuResponse = await fetch(
      "https://pay.fiuu.com/RMS/API/Direct/1.4.0/index.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      }
    );

    const fiuuResponseJson = await fiuuResponse.json();
    if (!fiuuResponse.ok) {
      return NextResponse.json(
        {
          error: `Failed to process payment data: ${payload.CC_PAN.slice(-4)}`,
        },
        { status: 500 }
      );
    }

    console.log({ fiuuResponseJson });

    console.log("Successfully decrypted card data:", {
      pan_ending_in: payload.CC_PAN.slice(-4),
      expiry: `${payload.CC_MONTH}/${payload.CC_YEAR}`,
      fiuuResponse,
      timestamp: new Date(payload.ts).toISOString(),
    });

    return NextResponse.json({
      message: `Payment data for card ending in ${payload.CC_PAN.slice(
        -4
      )} received.`,
      response: fiuuResponseJson,
    });
  } catch (err: unknown) {
    console.error("Decryption failed:", err);
    const message =
      err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `Failed to process payment data: ${message}` },
      { status: 500 }
    );
  }
}
