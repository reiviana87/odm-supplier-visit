"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import { Tag } from "@/components/ui/badge";
import { Blueprint } from "@/components/ui/blueprint";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress";
import {
  Table,
  TableFrame,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { CURRENT_USER, TEAM } from "@/lib/mock-data";
import { USER_ROLES, type UserRole } from "@/types/domain";

/**
 * Settings — README §1.18, transcribed from the approved prototype
 * (design-handoff/ODM Supplier Visit.dc.html lines 1581..1714): a 218px tab
 * rail with a hairline right border beside the panel column, two-column field
 * grids at max-width 620px and `.hr` separators between blocks.
 *
 * Persistence is Phase 2. Every panel that can be edited is a real form whose
 * submit reports that, rather than a control that silently does nothing.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Tabs
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The seven approved tabs (prototype `setTabs`, line 3104). The list and the
 * slug validation live in the route, which owns routing: every runtime export
 * of a `"use client"` module reaches a Server Component as a client reference,
 * not as the array itself. Types are erased, so they cross freely.
 */
export type SettingsTabId =
  | "profile"
  | "ai"
  | "templates"
  | "defaults"
  | "members"
  | "roles"
  | "storage";

export interface SettingsTabItem {
  id: SettingsTabId;
  label: string;
}

const TAB_BASE: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 10px",
  border: 0,
  textDecoration: "none",
  font: "12.5px var(--font-body)",
};

export function SettingsTabs({
  items,
  active,
}: {
  items: readonly SettingsTabItem[];
  active: SettingsTabId;
}) {
  return (
    <nav
      aria-label="Settings sections"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderRight: "1px solid var(--color-divider)",
        paddingRight: 8,
      }}
    >
      {items.map((tab) => {
        const current = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`/settings/${tab.id}`}
            aria-current={current ? "page" : undefined}
            style={
              current
                ? {
                    ...TAB_BASE,
                    background: "var(--color-accent-100)",
                    boxShadow: "inset 2px 0 0 var(--color-accent)",
                    color: "var(--color-text)",
                  }
                : {
                    ...TAB_BASE,
                    background: "transparent",
                    color: "var(--color-neutral-800)",
                  }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared pieces
   ═══════════════════════════════════════════════════════════════════════════ */

const SAVE_MESSAGE =
  "Saving settings lands with the settings store — your changes are still on screen but were not stored.";

/**
 * The design system's `.radio` (hidden input + `.dot`) is not part of this
 * codebase's stylesheet, so the control is a native radio tinted with
 * `accent-color` — same 16px circle, and it keeps native keyboard behaviour.
 */
function Radio({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      <input
        type="radio"
        name={name}
        defaultChecked={defaultChecked}
        style={{
          width: 16,
          height: 16,
          flex: "none",
          margin: 0,
          cursor: "pointer",
          accentColor: "var(--color-accent)",
        }}
      />
      <span>{children}</span>
    </label>
  );
}

/** An editable panel: the approved fields plus the save control they need. */
function SettingsForm({
  style,
  children,
}: {
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { toast } = useToast();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast(SAVE_MESSAGE);
  }

  return (
    <form onSubmit={handleSubmit} style={style}>
      {children}
      <div style={{ marginTop: 18 }}>
        <Button type="submit" variant="primary">
          Save changes
        </Button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Panels — prototype lines 1590..1710
   ═══════════════════════════════════════════════════════════════════════════ */

/** Not a field of `Profile`; the prototype's value for the department line. */
const DEPARTMENT = "Global Sourcing Office";
const SIGNATURE_BLOCK = `${CURRENT_USER.fullName}\nGlobal Sourcing Office · Global Business Strategy Development`;

function ProfilePanel() {
  const { toast } = useToast();

  return (
    <SettingsForm style={{ maxWidth: 620 }}>
      <h5 style={{ margin: "0 0 18px" }}>Profile</h5>

      <div
        style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            border: "1px solid var(--color-divider)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 17,
            color: "var(--color-accent-700)",
          }}
        >
          {CURRENT_USER.initials}
        </div>
        <Button
          variant="secondary"
          style={{ fontSize: 12.5 }}
          onClick={() =>
            toast(
              "Profile photos land with file storage — nothing was uploaded from this device.",
            )
          }
        >
          Change photo
        </Button>
      </div>

      <FieldGrid columns={2} gap={14}>
        <Field label="Full name">
          <Input defaultValue={CURRENT_USER.fullName} autoComplete="name" />
        </Field>
        <Field label="Display name">
          <Input defaultValue={CURRENT_USER.fullName} />
        </Field>
        <Field label="Role / title">
          <Input defaultValue={CURRENT_USER.jobTitle} />
        </Field>
        <Field label="Department">
          <Input defaultValue={DEPARTMENT} />
        </Field>
        <Field
          label="Signature block used in reports"
          style={{ gridColumn: "span 2" }}
        >
          <Textarea
            minHeight={64}
            defaultValue={SIGNATURE_BLOCK}
            style={{ fontSize: 13 }}
          />
        </Field>
      </FieldGrid>
    </SettingsForm>
  );
}

function AiPanel() {
  return (
    <SettingsForm>
      <h5 style={{ margin: "0 0 3px" }}>AI Preferences</h5>
      <p className="text-muted" style={{ fontSize: 12.5, margin: "0 0 18px" }}>
        Defaults applied to every AI action. Each action can still be overridden
        in the report.
      </p>

      <FieldGrid columns={2} gap={14} style={{ maxWidth: 620 }}>
        <Field label="Default writing style">
          <Select defaultValue="Professional Technical">
            <option>Professional Technical</option>
            <option>Executive</option>
            <option>Concise</option>
          </Select>
        </Field>
        <Field label="Default language">
          <Select defaultValue="English">
            <option>English</option>
            <option>English (US spelling)</option>
            <option>Japanese</option>
          </Select>
        </Field>
        <Field label="Photo caption style">
          <Select defaultValue="Technical / Production Engineering">
            <option>Technical / Production Engineering</option>
            <option>Short descriptive</option>
            <option>Equipment name only</option>
          </Select>
        </Field>
        <Field label="Conclusion style">
          <Select defaultValue="Executive Technical">
            <option>Executive Technical</option>
            <option>Full technical</option>
            <option>Executive summary only</option>
          </Select>
        </Field>
        <Field
          label="Caption confidence threshold — below this, a caption is flagged “review required”"
          style={{ gridColumn: "span 2" }}
        >
          <Input
            type="range"
            min={50}
            max={95}
            defaultValue={85}
            style={{
              padding: 0,
              minHeight: 24,
              background: "transparent",
              border: 0,
              accentColor: "var(--color-accent)",
            }}
          />
        </Field>
      </FieldGrid>

      <div className="hr" style={{ maxWidth: 620 }} />

      <div
        style={{
          maxWidth: 620,
          display: "flex",
          flexDirection: "column",
          gap: 11,
        }}
      >
        <Radio name="ai-approval-policy" defaultChecked>
          Always require my approval before AI text enters a report{" "}
          <Tag tone="accent" style={{ marginLeft: 6 }}>
            Recommended
          </Tag>
        </Radio>
        <Radio name="ai-approval-policy">
          Auto-accept captions above the confidence threshold
        </Radio>
      </div>
    </SettingsForm>
  );
}

function TemplatesPanel() {
  return (
    <div style={{ maxWidth: 620 }}>
      <h5 style={{ margin: "0 0 14px" }}>Document Templates</h5>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--color-neutral-800)",
        }}
      >
        Template administration lives on its own page, because uploading a new
        DOCX changes the output of every future export.
      </p>
      <ButtonLink href="/templates" variant="primary" style={{ marginTop: 8 }}>
        Open Report Templates
      </ButtonLink>
    </div>
  );
}

function DefaultsPanel() {
  return (
    <SettingsForm style={{ maxWidth: 620 }}>
      <h5 style={{ margin: "0 0 14px" }}>Default Report Settings</h5>
      <FieldGrid columns={2} gap={14}>
        <Field label="Document number prefix">
          <Input defaultValue="GSO-" />
        </Field>
        <Field label="Numbering pattern">
          <Input defaultValue="GSO-{YYMM}{SEQ}x00" />
        </Field>
        <Field label="Default business unit">
          <Select defaultValue="Building Service & Industrial">
            <option>Building Service &amp; Industrial</option>
            <option>Pumps</option>
            <option>Precision Machinery</option>
          </Select>
        </Field>
        <Field label="Default report owner">
          <Select defaultValue="Report creator">
            <option>Report creator</option>
            <option>{CURRENT_USER.fullName}</option>
          </Select>
        </Field>
        <Field label="Sections enabled by default" style={{ gridColumn: "span 2" }}>
          <Input defaultValue="All 12 sections" />
        </Field>
      </FieldGrid>
    </SettingsForm>
  );
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  editor: "Editor",
  viewer: "Viewer",
};

function MembersPanel() {
  const { toast } = useToast();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <h5 style={{ margin: 0, flex: 1 }}>Members</h5>
        <Button
          variant="secondary"
          style={{ fontSize: 12.5 }}
          onClick={() =>
            toast("Invitations land with team administration — no message was sent.")
          }
        >
          <Icon name="plus" size={13} />
          Invite member
        </Button>
      </div>

      <TableFrame>
        <Table>
          <Thead>
            <Tr>
              <Th>Member</Th>
              <Th>Department</Th>
              <Th>Role</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {TEAM.map((member) => (
              <Tr key={member.id}>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 28,
                        height: 28,
                        flex: "none",
                        border: "1px solid var(--color-divider)",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: 11,
                        color: "var(--color-accent-700)",
                      }}
                    >
                      {member.initials}
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: 13 }}>
                        {member.fullName}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 11,
                          color: "var(--color-neutral-600)",
                        }}
                      >
                        {member.email}
                      </span>
                    </span>
                  </div>
                </Td>
                <Td style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                  {member.jobTitle}
                </Td>
                <Td>
                  <Select
                    aria-label={`Role — ${member.fullName}`}
                    defaultValue={member.role}
                    style={{ width: "auto", fontSize: 12, minHeight: 28 }}
                    onChange={(event) =>
                      toast(
                        `Role changes land with team administration — ${member.fullName} is still ${
                          ROLE_LABELS[member.role]
                        }, not ${ROLE_LABELS[event.target.value as UserRole]}.`,
                      )
                    }
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td align="right">
                  <IconButton
                    variant="ghost"
                    name="more"
                    size={26}
                    iconSize={14}
                    label={`Actions — ${member.fullName}`}
                    style={{ color: "var(--color-neutral-600)" }}
                    onClick={() =>
                      toast("Member administration lands with team administration.")
                    }
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableFrame>
    </div>
  );
}

/** Prototype `roleRows`, line 3118 — the four fixed MVP roles. */
const ROLE_DEFINITIONS: Record<UserRole, { scope: string; level: string }> = {
  admin: { scope: "Users, suppliers, templates, reports", level: "Full" },
  manager: {
    scope: "Suppliers and reports; approve Final",
    level: "Write + approve",
  },
  editor: { scope: "Create and edit own reports", level: "Write" },
  viewer: { scope: "Read reports and export DOCX", level: "Read" },
};

function RolesPanel() {
  return (
    <div>
      <h5 style={{ margin: "0 0 3px" }}>Roles &amp; Permissions</h5>
      <p className="text-muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>
        Four fixed roles in the MVP — no custom permission sets.
      </p>
      <TableFrame style={{ maxWidth: 700 }}>
        <Table>
          <Thead>
            <Tr>
              <Th>Role</Th>
              <Th>Scope</Th>
              <Th>Access level</Th>
            </Tr>
          </Thead>
          <Tbody>
            {USER_ROLES.map((role) => (
              <Tr key={role}>
                <Td
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: 13.5,
                  }}
                >
                  {ROLE_LABELS[role]}
                </Td>
                <Td style={{ fontSize: 12.5 }}>{ROLE_DEFINITIONS[role].scope}</Td>
                <Td style={{ fontSize: 12.5, color: "var(--color-neutral-700)" }}>
                  {ROLE_DEFINITIONS[role].level}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableFrame>
    </div>
  );
}

/** Prototype line 1690 — the storage figures shown on the approved screen. */
const STORAGE_USED_GB = 38.4;
const STORAGE_TOTAL_GB = 200;

function StoragePanel() {
  const usedPercent = (STORAGE_USED_GB / STORAGE_TOTAL_GB) * 100;

  return (
    <SettingsForm style={{ maxWidth: 620 }}>
      <h5 style={{ margin: "0 0 14px" }}>Storage</h5>

      <Blueprint style={{ padding: 14, marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 26,
            }}
          >
            {STORAGE_USED_GB}
          </span>
          <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
            GB of {STORAGE_TOTAL_GB} GB used · 4,182 photos · 18 reports
          </span>
        </div>
        <ProgressBar value={usedPercent} height={6} label="Storage used" />
      </Blueprint>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <Radio name="storage-resolution" defaultChecked>
          Keep original iPhone resolution (recommended for appendix print
          quality)
        </Radio>
        <Radio name="storage-resolution">
          Optimise on upload — long edge 2400 px
        </Radio>
      </div>
    </SettingsForm>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Panel switch
   ═══════════════════════════════════════════════════════════════════════════ */

export function SettingsPanel({ tab }: { tab: SettingsTabId }) {
  switch (tab) {
    case "profile":
      return <ProfilePanel />;
    case "ai":
      return <AiPanel />;
    case "templates":
      return <TemplatesPanel />;
    case "defaults":
      return <DefaultsPanel />;
    case "members":
      return <MembersPanel />;
    case "roles":
      return <RolesPanel />;
    case "storage":
      return <StoragePanel />;
  }
}
