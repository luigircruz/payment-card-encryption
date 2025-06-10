"use server";
import type { CardDetails, EncryptedCardPayload } from "@/types/payment";
import { constants, privateDecrypt } from "crypto";
import fs from "fs/promises";
import path from "path";

// --- Configuration ---
const RSA_ALGORITHM_CONFIG = {
  hash: "sha256", // Node's crypto module prefers lowercase
};
const SERVER_PADDING_SCHEME = constants.RSA_PKCS1_OAEP_PADDING;

// --- Server-Side Logic ---
export async function decryptServerSide(
  encryptedPayload: string
): Promise<CardDetails> {
  const privateKeyPath = path.join(process.cwd(), "private_key.pem");
  const privateKey = await fs.readFile(privateKeyPath, "utf-8");

  // Node.js's Buffer can handle Base64 decoding directly. No need for atob.
  const encryptedBuffer = Buffer.from(encryptedPayload, "base64");

  const decryptedBuffer = privateDecrypt(
    {
      key: privateKey,
      padding: SERVER_PADDING_SCHEME,
      oaepHash: RSA_ALGORITHM_CONFIG.hash,
    },
    encryptedBuffer
  );

  const decryptedJson = decryptedBuffer.toString("utf-8");
  return JSON.parse(decryptedJson) as CardDetails;
}

/**
 * Decrypts a single Base64-encoded value.
 * @param privateKey The PEM-formatted private key.
 * @param encryptedValue The Base64 string to decrypt.
 * @returns The decrypted plaintext string.
 */
function decryptValue(privateKey: string, encryptedValue: string): string {
  const encryptedBuffer = Buffer.from(encryptedValue, "base64");
  const decryptedBuffer = privateDecrypt(
    {
      key: privateKey,
      padding: SERVER_PADDING_SCHEME,
      oaepHash: RSA_ALGORITHM_CONFIG.hash,
    },
    encryptedBuffer
  );
  return decryptedBuffer.toString("utf-8");
}

/**
 * Decrypts a payload where each field was encrypted individually.
 * @param payload The object containing individually encrypted fields.
 * @returns The reassembled, plaintext CardDetails object.
 */
export async function decryptCardFieldsIndividually(
  payload: EncryptedCardPayload
): Promise<CardDetails> {
  const privateKeyPath = path.join(process.cwd(), "private_key.pem");
  const privateKey = await fs.readFile(privateKeyPath, "utf-8");

  // Note the increased complexity and lack of atomicity.
  // If one of these fails, the data is in an inconsistent state.
  try {
    const pan = decryptValue(privateKey, payload.CC_PAN);
    const cvc = decryptValue(privateKey, payload.CC_CVV2);
    const exp_month = decryptValue(privateKey, payload.CC_MONTH);
    const exp_year = decryptValue(privateKey, payload.CC_YEAR);

    return { pan, cvc, exp_month, exp_year, ts: payload.ts };
  } catch (error) {
    console.error("Partial or full decryption failure:", error);
    throw new Error("Could not decrypt one or more payment fields.");
  }
}
