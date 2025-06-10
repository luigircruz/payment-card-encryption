// src/types/payment.ts

/**
 * Defines the structure of the payment card details object.
 */
export interface CardDetails {
  pan: string;
  cvc: string;
  exp_month: string;
  exp_year: string;
  ts: number; // Timestamp for replay protection
}

/**
 * The shape of the request body when fields are encrypted individually.
 */
export interface EncryptedCardPayload {
  CC_PAN: string;
  CC_CVV2: string;
  CC_MONTH: string;
  CC_YEAR: string;
  ts: number; // Timestamp can be sent in plaintext for validation
}

/**
 * The shape of the request body sent to the processing endpoint.
 */
export interface EncryptedPayloadRequest {
  encryptedPayload: string;
}

/**
 * The shape of the JSON response from the public key endpoint.
 */
export interface PublicKeyResponse {
  key: string;
}

/**
 * A generic error response from an API endpoint.
 */
export interface ErrorResponse {
  error: string;
}
