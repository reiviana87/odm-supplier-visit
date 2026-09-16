import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button";

/**
 * The Visit Mode stage — README §17, prototype lines 2167..2185.
 *
 * On a desktop viewport the approved composition is a `--color-accent-900`
 * page holding two things side by side: a 300px explanatory column and the
 * mobile app inside a 393×852 phone frame (screenshot 16). Measured from the
 * prototype:
 *
 *   stage   min-height 100vh · accent-900 · flex · align-items flex-start
 *           justify-content center · gap 40px · padding 36px 24px · wrap
 *   column  width 300 · flex none · colour #e6ebf0 · padding-top 20
 *           logo 60px inverted · 10px/.16em kicker · Barlow Condensed 600 32px
 *           title · 13px/1.65 paragraph · three 12.5px numbered notes ·
 *           a secondary "Back to desktop editor" button
 *   device  393×852 (iPhone proportions), simulated iOS chrome above the app
 *
 * [INFERRED] — the responsive collapse. The desktop composition above is
 * approved; the prototype has no phone-viewport capture. Below 900px the
 * explanatory column and the simulated device chrome are dropped and the app
 * surface fills the viewport, because on an actual phone the device already
 * draws its own status bar and the frame would be a picture of the thing the
 * user is holding. README §18 — "Visit Mode is the mobile product".
 *
 * The media query lives in a component-scoped <style> rather than in
 * globals.css: this file owns the only two layouts that use these rules, and
 * the collapse has to work without JavaScript so the first paint is correct.
 */

/** Device geometry, in the device's own pixels. */
const SCREEN_WIDTH = 393;
const SCREEN_HEIGHT = 852;

/**
 * Visit Mode's scoped stylesheet. It carries the three things inline `style`
 * cannot express and that must not be added to globals.css: the ≥900px
 * composition, the `:hover` states the prototype declares through
 * `style-hover` on the home tiles (line 2204) and the caption / category chips
 * (line 2259), and `.vm-hit`. Every Visit Mode screen renders inside this
 * frame, so the rules are guaranteed to be present wherever those class names
 * are used.
 *
 * `.vm-hit` is the product owner's confirmed touch-target decision: "Keep the
 * approved visual appearance of the compact chips … use an invisible /
 * transparent interaction wrapper or additional hit-area padding without
 * changing the approved visual appearance." The transparent `::after` grows the
 * control's hit box by 7px above and below without moving a painted pixel — the
 * border, ground, font and padding are untouched, and the overlay is part of the
 * button for hit testing, so the whole 44px lands on the right control.
 *
 * 7px is half of the 14px a 30px chip is short of README §24's "Touch targets in
 * Visit Mode: ≥44px". Its partner is the `rowGap: 14` each wrapping chip row
 * carries: row pitch then equals the hit box exactly, so the hit areas of two
 * wrapped rows tile edge to edge and can never overlap, whatever the painted
 * chip height works out to.
 *
 * The simulated iOS chrome is deliberately NOT the app's typography: it stands
 * in for the operating system, so it uses the platform UI font.
 */
const FRAME_CSS = `
.vm-stage{min-height:100vh;min-height:100dvh;background:var(--color-accent-900);font-family:var(--font-body)}
.vm-tile:hover{background:var(--color-accent-100);border-color:var(--color-accent-300)}
.vm-chip:hover{border-color:var(--color-accent-400);background:var(--color-accent-100)}
.vm-hit{position:relative}
.vm-hit::after{content:"";position:absolute;inset:-7px 0}
.vm-aside{display:none}
.vm-device{position:relative;display:flex;flex-direction:column;min-height:100vh;min-height:100dvh;background:var(--color-bg);overflow:hidden}
.vm-chrome{display:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.vm-app{flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto}
.vm-back:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.5);color:#fff}
@media (min-width:900px){
.vm-stage{display:flex;align-items:flex-start;justify-content:center;gap:40px;padding:36px 24px;flex-wrap:wrap}
.vm-aside{display:block;width:300px;flex:none;color:#e6ebf0;padding-top:20px}
.vm-device{width:${SCREEN_WIDTH}px;height:${SCREEN_HEIGHT}px;min-height:0;flex:none;border-radius:48px;box-shadow:var(--shadow-lg)}
.vm-chrome{display:block}
.vm-statusbar{position:relative;display:flex;align-items:center;justify-content:space-between;height:59px;padding:0 28px;font-size:15px;font-weight:600;letter-spacing:.01em;color:var(--color-text)}
.vm-island{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:125px;height:37px;border-radius:19px;background:#000}
.vm-signals{display:flex;align-items:center;gap:6px;color:var(--color-text)}
.vm-navbar{display:flex;align-items:center;justify-content:space-between;height:44px;padding:0 18px}
.vm-navbtn{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:color-mix(in srgb, var(--color-text) 6%, transparent);color:var(--color-text)}
.vm-title{margin:0;padding:4px 16px 12px;font-family:inherit;font-size:36px;font-weight:700;line-height:1.12;letter-spacing:-.02em;color:var(--color-text)}
.vm-home{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:color-mix(in srgb, var(--color-text) 30%, transparent)}
}
`;

/** The three numbered notes of the explanatory column (prototype line 2174). */
const NOTES: readonly string[] = [
  "Photos are stamped with time and section, so the appendix arrives pre-ordered.",
  "Observations land directly in §6 with their category.",
  "Nothing is lost on a dropped connection — the queue survives app restarts.",
];

export interface PhoneFrameProps {
  /** The simulated large-title text. */
  title: string;
  /** Where "Back to desktop editor" goes — the open report's editor. */
  editorHref: string;
  children: ReactNode;
}

export function PhoneFrame({ title, editorHref, children }: PhoneFrameProps) {
  return (
    <>
      <style>{FRAME_CSS}</style>
      <div className="vm-stage">
        <aside className="vm-aside">
          {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic
              size is unknown and the mark must scale to an exact 60px width. */}
          <img
            src="/brand/ebara-logo.png"
            alt="EBARA"
            style={{
              width: 60,
              height: "auto",
              filter: "brightness(0) invert(1)",
              opacity: 0.9,
              marginBottom: 14,
            }}
          />
          <div
            style={{
              font: "10px var(--font-body)",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.5)",
              marginBottom: 6,
            }}
          >
            Field capture
          </div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 32,
              lineHeight: 1.05,
              color: "#fff",
              marginBottom: 12,
            }}
          >
            Visit Mode
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: "rgba(255,255,255,.68)",
              margin: "0 0 18px",
            }}
          >
            A deliberately small surface for use inside a factory: capture photos,
            notes and observations against the open visit, then finish the report
            on the desktop. Everything is queued locally and syncs when the
            connection returns.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
              fontSize: 12.5,
              color: "rgba(255,255,255,.8)",
            }}
          >
            {NOTES.map((note, index) => (
              <div key={note} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: "var(--color-accent-300)" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{note}</span>
              </div>
            ))}
          </div>
          <ButtonLink
            href={editorHref}
            variant="secondary"
            icon="left"
            className="vm-back"
            style={{ marginTop: 22, color: "#fff", borderColor: "rgba(255,255,255,.28)" }}
          >
            Back to desktop editor
          </ButtonLink>
        </aside>

        <div className="vm-device">
          {/* The device shell stands in for the hardware and the OS: it is a
              picture of a phone, not an app control, so it is hidden from
              assistive technology and carries no interactive elements. */}
          <div
            className="vm-chrome"
            aria-hidden="true"
            style={{ background: "var(--color-neutral-100)", flex: "none" }}
          >
            <div className="vm-statusbar">
              <span>9:41</span>
              <span className="vm-island" />
              <span className="vm-signals">
                <CellularGlyph />
                <WifiGlyph />
                <BatteryGlyph />
              </span>
            </div>
            <div className="vm-navbar">
              <span className="vm-navbtn">
                <svg
                  viewBox="0 0 24 24"
                  width={17}
                  height={17}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </span>
              <span className="vm-navbtn">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </span>
            </div>
            <p className="vm-title">{title}</p>
          </div>

          <div className="vm-app">{children}</div>

          <div className="vm-chrome vm-home" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Status-bar glyphs. These belong to the simulated device, not to the app's
   approved icon set (@/components/ui/icon), which is why they are drawn here.
   ─────────────────────────────────────────────────────────────────────────── */

function CellularGlyph() {
  return (
    <svg viewBox="0 0 18 12" width={17} height={11} fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="3" width="3" height="9" rx="1" />
      <rect x="15" y="0" width="3" height="12" rx="1" />
    </svg>
  );
}

function WifiGlyph() {
  return (
    <svg
      viewBox="0 0 16 12"
      width={16}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
    >
      <path d="M1.4 4.1a9.6 9.6 0 0 1 13.2 0" />
      <path d="M4.2 7a5.6 5.6 0 0 1 7.6 0" />
      <path d="M8 10.1h.01" />
    </svg>
  );
}

function BatteryGlyph() {
  return (
    <svg viewBox="0 0 25 12" width={24} height={11} fill="none">
      <rect
        x="0.6"
        y="0.6"
        width="20.8"
        height="10.8"
        rx="3"
        stroke="currentColor"
        strokeWidth={1.2}
        opacity={0.4}
      />
      <rect x="2.2" y="2.2" width="17.6" height="7.6" rx="1.6" fill="currentColor" />
      <path
        d="M23.2 4.3a2 2 0 0 1 0 3.4z"
        fill="currentColor"
        opacity={0.4}
      />
    </svg>
  );
}
