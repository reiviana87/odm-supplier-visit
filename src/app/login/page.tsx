import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Login — README §1.1. The one screen that carries the product identity.
 *
 * Two columns, `grid-template-columns: 1.15fr 1fr`, full viewport height.
 * Left: the technical grid ground, EBARA logo 88px, kicker, 42px hero, one
 * paragraph, the GSO logo filling the remaining height, and a 34px steel
 * footer band. Right: the centred blueprint card, width min(360px, 100%),
 * padding 32px 30px.
 *
 * There is no screenshot for this screen; every value below is transcribed
 * from the approved prototype (design-handoff/ODM Supplier Visit.dc.html
 * lines 71..109).
 *
 * README §1.1 responsive: "below 900px the left panel is dropped, the card
 * centres" — marked [INFERRED] in the handoff and implemented as specified.
 */
export default function LoginPage() {
  return (
    <div className="login-grid" style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <div
        className="login-panel relative overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-divider)",
          backgroundImage:
            "linear-gradient(var(--color-accent-200) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent-200) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      >
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-none" style={{ padding: "38px 44px 0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic
                size is unknown and the logo must scale to an exact 88px width. */}
            <img
              src="/brand/ebara-logo.png"
              alt="EBARA"
              style={{ width: 88, height: "auto", marginBottom: 26 }}
            />
            <div style={{ maxWidth: 430 }}>
              <div
                style={{
                  font: "11px var(--font-body)",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "var(--color-accent-700)",
                  marginBottom: 9,
                }}
              >
                Global Sourcing Office
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 42,
                  lineHeight: 1.02,
                  letterSpacing: "-.02em",
                  whiteSpace: "nowrap",
                  margin: 0,
                }}
              >
                ODM Supplier Visit
              </h1>
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "var(--color-neutral-800)",
                  margin: "14px 0 0",
                }}
              >
                Factory visit documentation, supplier intelligence and corporate report
                generation across the ODM pump, motor and component range.
              </p>
            </div>
          </div>

          <div className="relative min-h-0 flex-1" style={{ marginTop: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fills the
                remaining height with object-fit; next/image cannot express this
                without a fixed intrinsic ratio. */}
            <img
              src="/brand/gso-logo.png"
              alt="Global Sourcing Office"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center 40%",
                padding: "0 44px 34px",
              }}
            />
          </div>

          <div className="flex-none" style={{ height: 34 }} />
        </div>

        <div
          className="absolute inset-x-0 bottom-0 flex items-center"
          style={{
            height: 34,
            background: "var(--color-accent-900)",
            padding: "0 44px",
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.62)",
            }}
          >
            Building Service &amp; Industrial Company · Ebara Corporation
          </span>
        </div>
      </div>

      <div className="grid place-items-center" style={{ padding: 40 }}>
        <LoginForm />
      </div>
    </div>
  );
}
