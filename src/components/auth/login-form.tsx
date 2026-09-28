"use client";

import { useState, useTransition } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { requestPasswordReset, signInWithAzure, signInWithPassword } from "@/lib/auth/actions";

/**
 * The sign-in card — README §1.1.
 *
 *   .blueprint card, width min(360px, 100%), padding 32px 30px
 *   Sign in (.btn-primary, full width) · "Continue with Microsoft 365" secondary
 *   States: default, invalid credentials, disabled while submitting
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html lines 92..107.
 */
export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signInWithPassword(formData);
      if ("error" in result) setError(result.error);
    });
  }

  /**
   * README §1.1 — an account can have no password at all: `create-admin`
   * invites rather than assigns one, and if that email never arrives this is
   * the only way in. The reply never says whether the address is registered.
   */
  function handleReset() {
    setError(null);
    setNotice(null);
    const email = (document.getElementById("login-email") as HTMLInputElement | null)?.value ?? "";
    if (!email.trim()) {
      setError("Enter your work email first, then ask for the reset link.");
      return;
    }
    const formData = new FormData();
    formData.set("email", email);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if ("error" in result) setError(result.error);
      else setNotice(`If ${email} has an account, a link to set a password is on its way.`);
    });
  }

  function handleAzure() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithAzure();
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <Blueprint
      as="form"
      action={handleSubmit}
      className="relative"
      style={{ width: "min(360px, 100%)", padding: "32px 30px" }}
    >
      <h4 style={{ margin: "0 0 4px" }}>Sign in</h4>
      <p className="text-muted" style={{ fontSize: 12.5, margin: "0 0 22px" }}>
        Use your Ebara corporate account.
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="login-email">Work email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          className="input"
          autoComplete="username"
          required
          defaultValue="alves.reinaldo@ebara.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      {error ? (
        <p
          id="login-error"
          role="alert"
          className="field-error"
          style={{ marginTop: -10, marginBottom: 14 }}
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          style={{
            fontSize: 11.5,
            color: "var(--color-accent-800)",
            background: "var(--color-accent-100)",
            border: "1px solid var(--color-accent-300)",
            padding: "8px 10px",
            marginTop: -10,
            marginBottom: 14,
          }}
        >
          {notice}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        block
        loading={pending}
        style={{ marginBottom: 10 }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <Button type="button" variant="secondary" block onClick={handleAzure} disabled={pending}>
        Continue with Microsoft 365
      </Button>

      <button
        type="button"
        onClick={handleReset}
        disabled={pending}
        className="bg-transparent"
        style={{
          border: 0,
          padding: "10px 0 0",
          width: "100%",
          cursor: pending ? "default" : "pointer",
          font: "11.5px var(--font-body)",
          color: "var(--color-neutral-600)",
          textDecoration: "underline",
        }}
      >
        Forgot your password, or never set one?
      </button>

      <div className="hr" />

      <div
        className="text-muted flex items-center"
        style={{ gap: 7, fontSize: 11.5 }}
      >
        <Icon name="alert" size={13} />
        Access is scoped by role: Admin, Manager, Editor, Viewer.
      </div>
    </Blueprint>
  );
}
