// src/app/api/process-payment/route.ts

import type { EncryptedCardPayload, ErrorResponse } from "@/types/payment";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

interface SuccessResponse {
  message: string;
}

// Assume these are your variables
const amount = "1";
const merchantID = "SB_metromarttech";
const referenceNumber = "user-12345";
const verifykey = "8f781073bc82fc22c3c1ace6f714874c"; // This should be an environment variable!

// 1. Concatenate the strings in the exact same order.
const stringToHash = `${amount}${merchantID}${referenceNumber}${verifykey}`;

const signature = createHash("md5").update(stringToHash).digest("hex");

// const stringToSign = `${amount}${merchantID}${referenceNumber}`;

// const signature = createHmac("sha512", verifykey)
//   .update(stringToSign)
//   .digest("hex");

export async function POST(
  request: Request
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const payload: EncryptedCardPayload = await request.json();
    if (!payload) {
      return NextResponse.json({ error: "Missing payload." }, { status: 400 });
    }

    console.log({ payload, signature });

    // All the complex logic is now in one function call
    // const cardDetails = await decryptCardFieldsIndividually(payload);

    const formData = new FormData();

    // 2. Append each key-value pair to the FormData object
    formData.append("MerchantID", "SB_metromarttech");
    formData.append("ReferenceNo", referenceNumber);
    formData.append("TxnType", "SALS");
    formData.append("TxnChannel", "CREDITAN");
    formData.append("TxnCurrency", "PHP");
    formData.append("TxnAmount", "1");
    formData.append("Signature", "3f3cf67c9956f9093643960c355b84d1");
    formData.append("ReturnURL", "http://localhost:3000/fiuu/payments/success");
    formData.append("FailedURL", "http://localhost:3000/fiuu/payments/failed");
    formData.append(
      "NotificationURL",
      "http://localhost:3001/api/v2/fiuu/webhooks/notification-url"
    );
    formData.append(
      "CallbackURL",
      "http://localhost:3000/api/v2/fiuu/webhooks/callback-url"
    );
    formData.append("CC_PAN", payload.CC_PAN);
    formData.append("CC_CVV2", payload.CC_CVV2);
    formData.append("CC_MONTH", payload.CC_MONTH);
    formData.append("CC_YEAR", payload.CC_YEAR);

    const fiuuResponse = await fetch(
      "https://sandbox.merchant.razer.com/RMS/API/Direct/1.4.0/index.php",
      {
        method: "POST",
        body: formData,
      }
    );

    const fiuuResponseJson = await fiuuResponse.json();

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
    // return NextResponse.json({
    //   message: "Success",
    // });
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
