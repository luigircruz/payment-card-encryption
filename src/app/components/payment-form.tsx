"use client";

import { encryptCardFieldsIndividually } from "@/lib/encryption"; // Import our new function
import type { CardDetails } from "@/types/payment";
import { FormEvent, useState } from "react";

export default function PaymentForm() {
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

      // All the complex encryption logic is now in one function call
      const encryptedFields = await encryptCardFieldsIndividually(cardDetails);

      console.log({ encryptedFields });

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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "An unknown server error occurred.");
      }

      console.log({ result });

      setStatus(`Server response: ${result.message}`);

      // const params = result.response.TxnData.RequestData.paRes;
      // const sendToOTP = await fetch(
      //   `${result.response.TxnData.RequestURL}?paRes=${params}`,
      //   { method: "POST" }
      // );

      // console.log({ sendToOTP });
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
      <h3>Manual Card Encryption</h3>
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
