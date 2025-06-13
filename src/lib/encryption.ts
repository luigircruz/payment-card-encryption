import { CardDetails, EncryptedCardPayload } from "@/types/payment";
import crypto from "crypto";

/**
 * Encodes data into a Base64 string.
 * If the input is a Buffer, it's converted directly.
 * If the input is a string, it's first converted to a Buffer using UTF-8
 * encoding, then to Base64.
 *
 * @param data The data to encode, either as a Buffer or a string.
 * @returns A Base64 encoded string.
 */
export function toBase64(data: Buffer | string): string {
  if (Buffer.isBuffer(data)) {
    // If it's already a buffer, just encode it
    return data.toString("base64");
  }
  // If it's a string, convert it to a buffer first, then encode
  return Buffer.from(data, "utf8").toString("base64");
}

// --- Browser-Only Helper Functions ---
function pemToBuffer(pem: string): ArrayBuffer {
  const base64String = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  // This uses a browser-only API
  const binaryString = window.atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// --- Client-Side Logic ---
const getImportedPublicKey = (() => {
  let keyPromise: Promise<CryptoKey> | null = null;

  return (): Promise<CryptoKey> => {
    if (!keyPromise) {
      keyPromise = (async () => {
        // 1. Read the key directly from the environment variable.
        const pemKey = process.env.NEXT_PUBLIC_RSA_PUBLIC_KEY;

        if (!pemKey) {
          throw new Error(
            "NEXT_PUBLIC_RSA_PUBLIC_KEY is not defined in .env.local"
          );
        }

        // 2. The rest of the logic is the same.
        const keyBuffer = pemToBuffer(pemKey);
        return window.crypto.subtle.importKey(
          "spki",
          keyBuffer,
          { name: "RSA-OAEP", hash: "SHA-512" },
          true,
          ["encrypt"]
        );
      })();
    }
    return keyPromise;
  };
})();

/**
 * Encrypts data using an RSA public key.
 * @param {string} plaintext - The data to encrypt.
 * @returns {string} The encrypted data.
 */
export const encrypt = (plaintext: string): string => {
  const dataBuffer = Buffer.from(plaintext);

  // const encryptedData = crypto.publicEncrypt(
  //   "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhuAx2cpMF30b8gvzIuPoFM5G5LMZaqHTOvMItmCazq6OYNHfB4b0cy+4FF/vcIviGAtOQFitdcik5VbFdGiLGuHseN1y98Li6u6RI2oAvBNWZEifUxpEdVV09zHADSEfJo2iGb1sUe+XRx2RmPutQTmyeg6Edlor+C3AnrNW8fkYCMY7U1dgXzx2B9aAMGRtHIwMqp07NqKIiUpzh6EMELTxeJFCW0TfDH9QHN08cs+UO7r32gTBAGk7KpX4ekkBjfmB5+36vMl1/3pKP8N6/MonqhHu8LT9W36otOHlBmQ3dK0TUUzCSfMSYGubkP/dT+2UQvTPykDrAEGSYPLMGQIDAQAB\n-----END PUBLIC KEY-----",
  //   dataBuffer
  // );
  const encryptedData: Buffer = crypto.publicEncrypt(
    {
      key: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhuAx2cpMF30b8gvzIuPoFM5G5LMZaqHTOvMItmCazq6OYNHfB4b0cy+4FF/vcIviGAtOQFitdcik5VbFdGiLGuHseN1y98Li6u6RI2oAvBNWZEifUxpEdVV09zHADSEfJo2iGb1sUe+XRx2RmPutQTmyeg6Edlor+C3AnrNW8fkYCMY7U1dgXzx2B9aAMGRtHIwMqp07NqKIiUpzh6EMELTxeJFCW0TfDH9QHN08cs+UO7r32gTBAGk7KpX4ekkBjfmB5+36vMl1/3pKP8N6/MonqhHu8LT9W36otOHlBmQ3dK0TUUzCSfMSYGubkP/dT+2UQvTPykDrAEGSYPLMGQIDAQAB\n-----END PUBLIC KEY-----",
    },
    dataBuffer
  );
  return `ENC_CARD_${toBase64(encryptedData)}`;
};

/**
 * Encrypts each field of the card details object individually.
 * @param cardDetails The object containing plaintext card details.
 * @returns An object with each field individually encrypted and Base64-encoded.
 */
export async function encryptCardFieldsIndividually(
  cardDetails: Omit<CardDetails, "ts">
): Promise<Omit<EncryptedCardPayload, "ts">> {
  // Note the performance impact: this runs 4 separate, slow RSA operations.
  const [CC_PAN, CC_CVV2, CC_MONTH, CC_YEAR] = await Promise.all([
    encrypt(cardDetails.pan),
    encrypt(cardDetails.cvc),
    encrypt(cardDetails.exp_month),
    encrypt(cardDetails.exp_year),
  ]);

  return {
    CC_PAN,
    CC_CVV2,
    CC_MONTH,
    CC_YEAR,
  };
}
