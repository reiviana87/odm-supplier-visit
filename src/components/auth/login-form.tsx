"use client";

import { useState, useTransition } from "react";

import { Blueprint } from "@/components/ui/blueprint";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { signInWithAzure, signInWithPassword } from "@/lib/auth/actions";

/**
 * The sign-in card — README §1.1.
 *
 *   .blueprint card, width min(360px, 100%), padding 32px 30px
 *   Sign in (.btn-primary, full width) · "Continue with Microsoft 365" secondary
 *   States: default, invalid credentials, disabled while submitting
 *
 * Prototype: design-handoff/ODM Supplier Visit.dc.html lines 92..107.
 */
export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signInWithPassword(formData);
      if ("error" in result) setError(result.error);
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
