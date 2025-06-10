// src/app/components/ManualPaymentForm.tsx
"use client";

import {
  encryptCardFieldsIndividually,
  encryptClientSide,
} from "@/lib/crypto.client"; // Import our new function
import type { CardDetails } from "@/types/payment";
import { FormEvent, useState } from "react";

export default function ManualPaymentForm() {
  const [status, setStatus] = useState<string>("Ready to encrypt.");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setStatus("Encrypting...");
    setError("");

    try {
      const formData = new FormData(event.currentTarget);
      const cardDetails: CardDetails = {
        pan: formData.get("pan") as string,
        cvc: formData.get("cvc") as string,
        exp_month: formData.get("exp_month") as string,
        exp_year: formData.get("exp_year") as string,
        ts: Date.now(),
      };

      // All the complex logic is now in one function call
      const encryptedPayload = await encryptClientSide(cardDetails);
      const encryptedFields = await encryptCardFieldsIndividually(cardDetails);

      console.log({ encryptedFields, encryptedPayload });

      setStatus("Data encrypted. Sending to server...");
      const payload = {
        ...encryptedFields,
        ts: Date.now(),
      };

      const response = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the new payload structure
        body: JSON.stringify(payload),
      });

      //   const response = await fetch("/api/process-payment", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({ encryptedPayload }),
      //   });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "An unknown server error occurred.");
      }

      console.log({ result });

      setStatus(`Server response: ${result.message}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("Form submission failed:", err);
      setError(message);
      setStatus("Error.");
    }
  };

  return (
    <div style={{ color: "black", maxWidth: "400px" }}>
      <h3>Educational: Manual Card Encryption (Refactored)</h3>
      <form onSubmit={handleSubmit}>
        <input name="pan" placeholder="Card Number" required />
        <input name="cvc" placeholder="CVC" required />
        <input name="exp_month" placeholder="MM" required />
        <input name="exp_year" placeholder="YYYY" required />
        <button type="submit" disabled={status === "Encrypting..."}>
          {status === "Encrypting..." ? "Processing..." : "Encrypt and Submit"}
        </button>
      </form>
      <p>Status: {status}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
