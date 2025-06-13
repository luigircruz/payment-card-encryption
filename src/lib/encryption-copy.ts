import type { CardDetails, EncryptedCardPayload } from "@/types/payment";
import CryptoJS from "crypto-js";
import JSEncrypt from "jsencrypt";

// --- Configuration ---
const RSA_ALGORITHM_CONFIG = {
  name: "RSA-OAEP",
  hash: "SHA-512",
};

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

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // This uses a browser-only API
  return window.btoa(binary);
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

function randHEX(value: number) {
  let result = "";
  const char_list = "0123456789ABCDEF";
  for (let i = 0; i < value; i++)
    result += char_list.charAt(Math.floor(Math.random() * char_list.length));
  return result;
}

/**
 * Encrypts a single string value.
 * @param value The string to encrypt.
 * @returns A Base64-encoded string of the encrypted data.
 */
async function encryptFieldValue(value: string): Promise<string> {
  // const publicKey = await getImportedPublicKey();
  const rsa = new JSEncrypt();
  // 1. Read the key directly from the environment variable.
  const pemKey = process.env.NEXT_PUBLIC_RSA_PUBLIC_KEY as string;
  rsa.setPublicKey(pemKey);
  // const dataToEncrypt = new TextEncoder().encode(value);

  // const encryptedBuffer = await window.crypto.subtle.encrypt(
  //   RSA_ALGORITHM_CONFIG, // Using the name from the shared config
  //   publicKey,
  //   dataToEncrypt
  // );
  // const encryptedValue = bufferToBase64(encryptedBuffer);
  const encrypted = rsa.encrypt(value) as string;
  const aes_iv = randHEX(32);
  const aes_key = randHEX(64);
  const keyBytes = CryptoJS.enc.Hex.parse(aes_key);
  const ivBytes = CryptoJS.enc.Hex.parse(aes_iv);

  //SECOND ENCRYPT WITH AES
  const encryptedValue = CryptoJS.AES.encrypt(encrypted, keyBytes, {
    iv: ivBytes,
    padding: CryptoJS.pad.ZeroPadding,
  }).ciphertext.toString(CryptoJS.enc.Base64);

  return "ENC_CARD_" + encryptedValue + "|" + aes_iv + "|" + aes_key;

  // return `ENC_CARD_${encrypted}`;
}

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
    encryptFieldValue(cardDetails.pan),
    encryptFieldValue(cardDetails.cvc),
    encryptFieldValue(cardDetails.exp_month),
    encryptFieldValue(cardDetails.exp_year),
  ]);

  return {
    CC_PAN,
    CC_CVV2,
    CC_MONTH,
    CC_YEAR,
  };
}
