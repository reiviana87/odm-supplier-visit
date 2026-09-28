"use client";

import { useState, useTransition } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { setPassword } from "@/lib/auth/actions";

/**
 * Choose a password — the card the reset link lands on.
 *
 * Deliberately the same blueprint card as the sign-in form, at the same width
 * and padding, so arriving here from an email does not feel like a different
 * product.
 */
export function SetPasswordForm({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await setPassword(formData);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <Blueprint
      as="form"
      action={handleSubmit}
      style={{ width: "min(360px, 100%)", padding: "32px 30px" }}
    >
      <h4 style={{ margin: "0 0 4px" }}>Set your password</h4>
      <p className="text-muted" style={{ fontSize: 12.5, margin: "0 0 22px" }}>
        for {email}
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={error ? true : undefined}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-muted" style={{ fontSize: 11.5, marginTop: 5 }}>
          At least 10 characters. A short phrase you will remember beats a short
          password you will not.
        </p>
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={10}
        />
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            fontSize: 12,
            color: "var(--color-danger-ink)",
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger-border)",
            padding: "8px 10px",
            marginBottom: 14,
          }}
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Saving…" : "Save password and continue"}
      </Button>

      <p className="text-muted" style={{ fontSize: 11.5, marginTop: 14, marginBottom: 0 }}>
        <Icon name="check" size={12} /> You can change this later under Settings.
      </p>
    </Blueprint>
  );
}
