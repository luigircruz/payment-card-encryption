// src/lib/crypto.client.ts

import type { CardDetails, EncryptedCardPayload } from "@/types/payment";

// --- Configuration ---
const RSA_ALGORITHM_CONFIG = {
  name: "RSA-OAEP",
  hash: "SHA-256",
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
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt"]
        );
      })();
    }
    return keyPromise;
  };
})();

function randHEX(length: number): string {
  let result = "";
  const char_list = "0123456789ABCDEF";
  for (let i = 0; i < length; i++) {
    result += char_list.charAt(Math.floor(Math.random() * char_list.length));
  }
  return result;
}

/**
 * WARNING: FLAWED PATTERN - FOR LEGACY INTEGRATION ONLY
 * This function performs RSA encryption and then appends dummy IV and Key
 * values to match a specific, non-standard string format.
 * The appended IV and Key provide NO additional security.
 *
 * @param value The string to encrypt.
 * @returns A string in the format "ENC__rsa_encrypted_data|dummy_iv|dummy_key"
 */
async function encryptAndFormatForLegacy(value: string): Promise<string> {
  // 1. Perform the actual RSA encryption as before.
  const publicKey = await getImportedPublicKey();
  const dataToEncrypt = new TextEncoder().encode(value);

  // 2. Generate DUMMY IV and Key values. These are for formatting only.
  // They are NOT used in the encryption of the data.
  const dummyIV = randHEX(32);
  const dummyKey = randHEX(64); // Assuming this is what "IVKey" meant

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    dataToEncrypt
  );
  const encryptedValueBase64 = bufferToBase64(encryptedBuffer);

  // 3. Construct the final string in the required format.
  // Note: I am assuming "IVKeyBase65" was a typo for a Base16 (Hex) key.
  return `ENC__${encryptedValueBase64}|${dummyIV}|${dummyKey}`;
}

/**
 * Encrypts a single string value.
 * @param value The string to encrypt.
 * @returns A Base64-encoded string of the encrypted data.
 */
async function encryptValue(value: string): Promise<string> {
  const publicKey = await getImportedPublicKey();
  const initVector = crypto.getRandomValues(new Uint8Array(32));
  const initVectorKey = crypto.getRandomValues(new Uint8Array(64));
  const dataToEncrypt = new TextEncoder().encode(value);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP", iv: initVector }, // Using the name from the shared config
    publicKey,
    dataToEncrypt
  );
  // 6. Format the final output string for transport.
  // We Base64-encode each part to ensure safe string handling.
  const encryptedValue = bufferToBase64(encryptedBuffer);
  const ivBase64 = bufferToBase64(initVector.buffer);
  const ivKeyBase64 = bufferToBase64(initVectorKey.buffer);

  return `ENC__${encryptedValue}|${ivBase64}|${ivKeyBase64}`;
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
    encryptValue(cardDetails.pan),
    encryptValue(cardDetails.cvc),
    encryptValue(cardDetails.exp_month),
    encryptValue(cardDetails.exp_year),
  ]);

  return {
    CC_PAN,
    CC_CVV2,
    CC_MONTH,
    CC_YEAR,
  };
}

export async function encryptClientSide(data: object): Promise<string> {
  const publicKey = await getImportedPublicKey();
  const dataToEncrypt = new TextEncoder().encode(JSON.stringify(data));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: RSA_ALGORITHM_CONFIG.name },
    publicKey,
    dataToEncrypt
  );
  return bufferToBase64(encryptedBuffer);
}

/**
 * SECURE HYBRID ENCRYPTION
 * Encrypts a value using the standard AES-GCM + RSA-OAEP hybrid pattern.
 * @param value The plaintext string to encrypt.
 * @returns A formatted string containing the encrypted data, the encrypted key, and the IV.
 */
export async function hybridEncryptValue(value: string): Promise<string> {
  // 1. Generate a new, single-use AES-GCM key for this operation.
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // Allow the key to be exported (so we can encrypt it)
    ["encrypt", "decrypt"]
  );

  // 2. Generate a random Initialization Vector (IV) for the AES encryption.
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes is standard for GCM

  // 3. Encrypt the actual data with the new AES key.
  const dataEncoder = new TextEncoder();
  const encryptedDataBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    dataEncoder.encode(value)
  );

  // 4. Export the raw AES key so we can encrypt it with RSA.
  const rawAesKeyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);

  // 5. Encrypt the AES key with the server's public RSA key.
  const rsaPublicKey = await getImportedPublicKey(); // Uses our existing helper
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawAesKeyBuffer
  );

  // 6. Format the final output string for transport.
  // We Base64-encode each part to ensure safe string handling.
  const encryptedAesKeyBase64 = bufferToBase64(encryptedAesKeyBuffer);
  const ivBase64 = bufferToBase64(iv.buffer);
  const encryptedDataBase64 = bufferToBase64(encryptedDataBuffer);

  // Format: RSA-encrypted-AES-Key | IV | AES-encrypted-Data
  return `ENC__${encryptedAesKeyBase64}|${ivBase64}|${encryptedDataBase64}`;
}

// async function encryptValueTest(value: string): Promise<string> {
//   const publicKey = await getImportedPublicKey();
//   const algorithm = "sha512";

// const signature = createHmac(algorithm, publicKey)
//   .update(value)
//   .digest("base64");
// }
