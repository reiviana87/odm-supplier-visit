"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { Profile } from "@/types/domain";

/**
 * Application sidebar — README §2, measured from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 115..149).
 *
 *   width 218px, flex:none · background var(--color-accent-900) · text #e6ebf0
 *   position sticky, top 0, height 100vh, overflow auto
 *
 * README §2 is explicit that a desktop collapse control is NOT in the approved
 * design — do not add one. Below 1280px the shell scrolls horizontally rather
 * than reflowing, which keeps the approved layout intact (README §18 desktop
 * row is the only specified one).
 */

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  /** Extra path prefixes that keep this item lit (README: the editor lights Reports). */
  alsoActiveFor?: string[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/reports", label: "Reports", icon: "file", badge: "5" },
  { href: "/suppliers", label: "Suppliers", icon: "factory" },
  { href: "/assistant", label: "AI Assistant", icon: "spark" },
  { href: "/templates", label: "Templates", icon: "template", alsoActiveFor: ["/templates/mapping"] },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.alsoActiveFor ?? []).some((prefix) => pathname.startsWith(prefix));
}

export function Sidebar({
  user,
  onSignOut,
}: {
  user: Profile;
  onSignOut?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 flex h-screen flex-none flex-col overflow-auto"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--color-accent-900)",
        color: "#e6ebf0",
      }}
    >
      {/* Brand block — padding 18px 16px 14px, hairline bottom border. */}
      <div
        className="flex-none"
        style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,.12)",
        }}
      >
        <Image
          src="/brand/ebara-logo.png"
          alt="EBARA"
          width={66}
          height={26}
          priority
          style={{
            width: 66,
            height: "auto",
            filter: "brightness(0) invert(1)",
            opacity: 0.95,
            marginBottom: 9,
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: ".01em",
            color: "#fff",
          }}
        >
          ODM Supplier Visit
        </div>
      </div>

      <nav
        aria-label="Main"
        className="flex flex-1 flex-col"
        style={{ gap: 1, padding: "10px 8px" }}
      >
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} item={item} active={isActive(pathname, item)} />
        ))}

        <div
          style={{
            margin: "14px 8px 8px",
            font: "10px var(--font-body)",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.34)",
          }}
        >
          Field
        </div>

        {/* Visit Mode — a bordered row, visually distinct from the nav stack. */}
        <Link
          href="/visit"
          className="flex cursor-pointer items-center text-left"
          style={{
            gap: 9,
            padding: "7px 10px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,.16)",
            color: "rgba(255,255,255,.8)",
            font: "13px var(--font-body)",
            textDecoration: "none",
          }}
        >
          <Icon name="phone" size={15.5} />
          <span className="flex-1">Visit Mode</span>
          <Icon name="right" size={13} />
        </Link>
      </nav>

      {/* User footer — 32px initials square, name, role, settings + sign out. */}
      <div
        className="flex flex-none items-center"
        style={{
          padding: "12px 12px 14px",
          borderTop: "1px solid rgba(255,255,255,.12)",
          gap: 10,
        }}
      >
        <div
          aria-hidden="true"
          className="grid flex-none place-items-center"
          style={{
            width: 32,
            height: 32,
            background: "rgba(255,255,255,.13)",
            border: "1px solid rgba(255,255,255,.2)",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 13,
            color: "#fff",
          }}
        >
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate" style={{ fontSize: 12.5, color: "#fff" }}>
            {user.fullName}
          </div>
          <div
            className="truncate"
            style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)" }}
          >
            {user.jobTitle}
          </div>
        </div>
        <Link
          href="/settings/profile"
          aria-label="Settings"
          title="Settings"
          className="grid place-items-center"
          style={{
            width: 26,
            height: 26,
            color: "rgba(255,255,255,.55)",
          }}
        >
          <Icon name="settings" size={15} />
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="grid cursor-pointer place-items-center border-0 bg-transparent p-0"
          style={{ width: 26, height: 26, color: "rgba(255,255,255,.55)" }}
        >
          <Icon name="logout" size={15} />
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex cursor-pointer items-center text-left", "sidebar-item")}
      style={{
        gap: 9,
        padding: "7px 10px",
        border: 0,
        font: "13.5px var(--font-body)",
        textDecoration: "none",
        background: active ? "rgba(255,255,255,.11)" : "transparent",
        color: active ? "#fff" : "rgba(230,235,240,.72)",
        boxShadow: active ? "inset 2px 0 0 var(--color-accent-400)" : undefined,
      }}
    >
      <Icon name={item.icon} size={15.5} />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span
          style={{
            fontSize: 10.5,
            padding: "1px 6px",
            background: "rgba(255,255,255,.14)",
            color: "rgba(255,255,255,.75)",
          }}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}
