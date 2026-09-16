import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  SettingsPanel,
  SettingsTabs,
  type SettingsTabId,
  type SettingsTabItem,
} from "@/components/settings/settings-tabs";

/**
 * Prototype `setTabs`, line 3104 — slug and label, in the approved order. The
 * list lives here because the route owns the slug: a Server Component cannot
 * read a runtime export out of a `"use client"` module.
 */
const SETTINGS_TABS: readonly SettingsTabItem[] = [
  { id: "profile", label: "Profile" },
  { id: "ai", label: "AI Preferences" },
  { id: "templates", label: "Document Templates" },
  { id: "defaults", label: "Default Report Settings" },
  { id: "members", label: "Members" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "storage", label: "Storage" },
];

function isSettingsTab(value: string): value is SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === value);
}

interface SettingsTabPageProps {
  params: Promise<{ tab: string }>;
}

export function generateStaticParams() {
  return SETTINGS_TABS.map((tab) => ({ tab: tab.id }));
}

export async function generateMetadata({
  params,
}: SettingsTabPageProps): Promise<Metadata> {
  const { tab } = await params;
  const label = SETTINGS_TABS.find((item) => item.id === tab)?.label;
  return { title: label ? `${label} · Settings` : "Settings" };
}

/**
 * `/settings/:tab` — README §1.18, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1581..1714): page padding
 * 26px 24px 40px, `Settings` 18px above a `218px minmax(0,1fr)` grid with a
 * 26px gutter, the whole block capped at 1000px.
 */
export default async function SettingsTabPage({ params }: SettingsTabPageProps) {
  const { tab } = await params;
  if (!isSettingsTab(tab)) notFound();

  return (
    <div className="anim-rise" style={{ padding: "26px 24px 40px" }}>
      <h2 style={{ margin: "0 0 18px" }}>Settings</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "218px minmax(0,1fr)",
          gap: 26,
          alignItems: "start",
          maxWidth: 1000,
        }}
      >
        <SettingsTabs items={SETTINGS_TABS} active={tab} />
        <div>
          <SettingsPanel tab={tab} />
        </div>
      </div>
    </div>
  );
}
