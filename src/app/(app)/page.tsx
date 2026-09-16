import type { Metadata } from "next";

import {
  AttentionList,
  type AttentionItem,
} from "@/components/dashboard/attention-list";
import { RecentReports } from "@/components/dashboard/recent-reports";
import { VisitList, type VisitItem } from "@/components/dashboard/visit-list";
import { ButtonLink } from "@/components/ui/button";
import { KpiCard, KpiGrid, type KpiDeltaTone } from "@/components/ui/kpi-card";
import {
  PageHeader,
  PageShell,
  SectionHeader,
} from "@/components/ui/page-header";
import { countReports, listReports } from "@/lib/data/reports";
import { countSuppliers, listSuppliers } from "@/lib/data/suppliers";
import type { ReportSummary } from "@/types/domain";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The dashboard answers "what needs attention today", so it is rendered per
 * request. While the demo fallback serves the reads the page has no dynamic
 * input of its own, and Next would prerender it — freezing the date line and
 * every count at the moment of the build.
 */
export const dynamic = "force-dynamic";

/** README §1.2 — five recent rows, three visit cards. */
const RECENT_REPORT_COUNT = 5;
const VISIT_COUNT = 3;

/** A figure the data layer could not answer. Better than a number nobody counted. */
const UNKNOWN = "—";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * `ReportSummary.visitDate` crosses as the display string the tables print
 * ("Aug 12, 2026") — a summary carries no ISO visit date — so the two visit
 * KPIs and the visit cards read it back with the month names `toDisplayDate()`
 * writes. A value in any other shape is left out of the counts rather than
 * guessed at.
 */
const VISIT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

interface VisitDate {
  month: string;
  day: string;
  /** "2026-08-12" — sortable, and comparable against today without a `Date`. */
  key: string;
}

interface DatedVisit {
  report: ReportSummary;
  date: VisitDate;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseVisitDate(value: string): VisitDate | null {
  const match = /^([A-Za-z]{3}) (\d{2}), (\d{4})$/.exec(value.trim());
  if (!match) return null;

  const monthIndex = VISIT_MONTHS.findIndex((name) => name === match[1]);
  if (monthIndex < 0) return null;

  return {
    month: match[1],
    day: match[2],
    key: `${match[3]}-${pad(monthIndex + 1)}-${match[2]}`,
  };
}

/** "Tangshan, Hebei" → "Hebei". A location with no comma is its own province. */
function provinceOf(location: string): string {
  const parts = location.split(",");
  return parts[parts.length - 1]?.trim() ?? "";
}

function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => !!value?.trim()))];
}

/** These are sentences, not labels: "1 reports ready for review" reads wrong. */
function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  delta?: string;
  tone: KpiDeltaTone;
}

/**
 * Dashboard — README §1.2, prototype lines 181..270, screenshot
 * `01-dashboard.png`.
 *
 * Page padding 26px 24px 40px; header (kicker, title, date line, Add Supplier +
 * New Visit Report); the 6-up KPI strip; then the two-column body
 * `minmax(0,1.85fr) minmax(300px,1fr)` at 22px, recent reports on the left and
 * the attention / visits column on the right.
 *
 * Every figure comes from the data layer — `countReports()`, `countSuppliers()`,
 * `listReports()` and `listSuppliers()` — so the screen describes the database
 * rather than the seed it was designed against. The four reads are independent
 * and go out together; each is handled on its own, and a panel whose read failed
 * shows that error's sentence instead of taking the dashboard down with it.
 *
 * **[INFERRED]** — New Visit Report points at `/reports/new`, the route README
 * §1 and §25 give the two-step modal. A Server Component cannot open the shell's
 * modal state, and a link is the right affordance for a modal route.
 */
export default async function DashboardPage() {
  const now = new Date();

  const [reportCountsResult, supplierCountsResult, reportsResult, suppliersResult] =
    await Promise.all([
      countReports(),
      countSuppliers(),
      listReports(),
      listSuppliers(),
    ]);

  const reportCounts = reportCountsResult.ok ? reportCountsResult.data : null;
  const supplierCounts = supplierCountsResult.ok ? supplierCountsResult.data : null;
  const reports = reportsResult.ok ? reportsResult.data : [];
  const reportsError = reportsResult.ok ? undefined : reportsResult.error.message;

  // The reports list already opens on the most recently edited report (§19), so
  // "recent" is its first rows rather than a second, differently ordered read.
  const recentReports = reports.slice(0, RECENT_REPORT_COUNT);

  const draftReports = reports.filter((report) => report.status === "draft");
  const reviewReports = reports.filter((report) => report.status === "in_review");

  // A visit exists in this app only as the report written about it, which is
  // what the two visit KPIs and the cards below count.
  const visits: DatedVisit[] = reports
    .map((report) => ({ report, date: parseVisitDate(report.visitDate) }))
    .filter((entry): entry is DatedVisit => entry.date !== null)
    .sort((a, b) => b.date.key.localeCompare(a.date.key));

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const thisYear = String(now.getFullYear());
  const thisMonth = `${thisYear}-${pad(now.getMonth() + 1)}`;

  const monthVisits = visits.filter((visit) => visit.date.key.startsWith(thisMonth));
  const yearVisits = visits.filter((visit) => visit.date.key.startsWith(thisYear));
  const monthProvinces = distinct(
    monthVisits.map((visit) => provinceOf(visit.report.location)),
  );
  const yearProvinces = distinct(
    yearVisits.map((visit) => provinceOf(visit.report.location)),
  );

  const visitItems: VisitItem[] = visits
    .slice(0, VISIT_COUNT)
    .map(({ report, date }) => {
      const planned = date.key > todayKey;
      return {
        id: report.id,
        month: date.month,
        day: date.day,
        supplier: report.supplierShortName,
        place: [report.location.trim(), planned ? "planned" : "completed"]
          .filter((part) => part !== "")
          .join(" · "),
        planned,
        status: report.status,
        href: `/reports/${report.id}/purpose`,
      };
    });

  // Only the rows a `ReportSummary` can prove. The approved panel also counts
  // reports missing their conclusion, images without captions and an unanalysed
  // transcript; none of those facts reaches a list row today, and an invented
  // count here would send someone looking for work that is not there.
  const attentionItems: AttentionItem[] = [];

  const incompleteDrafts = draftReports.filter((report) => report.completion < 100);
  if (incompleteDrafts.length > 0) {
    attentionItems.push({
      id: "incomplete-drafts",
      text: `${incompleteDrafts.length} draft ${plural(incompleteDrafts.length, "report")} still incomplete`,
      tone: "warning",
      href: "/reports",
    });
  }
  if (reviewReports.length > 0) {
    attentionItems.push({
      id: "ready-for-review",
      text: `${reviewReports.length} ${plural(reviewReports.length, "report")} ready for final review`,
      tone: "accent",
      href: "/reports",
    });
  }

  const supplierProvinces = suppliersResult.ok
    ? distinct(suppliersResult.data.map((supplier) => supplier.region))
    : null;

  const dateLine = `${WEEKDAY_FORMAT.format(now)}, ${DATE_FORMAT.format(now)}`;
  const suppliersTracked = supplierCounts
    ? `${supplierCounts.total} ${plural(supplierCounts.total, "supplier")} tracked`
    : null;
  const supplierLine =
    suppliersTracked && supplierProvinces
      ? `${suppliersTracked} across ${supplierProvinces.length} ${plural(supplierProvinces.length, "province")}`
      : suppliersTracked;

  const kpis: DashboardKpi[] = [
    {
      id: "total-suppliers",
      label: "Total Suppliers",
      value: supplierCounts ? String(supplierCounts.total) : UNKNOWN,
      delta: supplierCounts
        ? `${supplierCounts.dataSheetsReceived} data sheets received`
        : undefined,
      tone: "accent",
    },
    {
      id: "open-reports",
      label: "Open Reports",
      value: reportCounts ? String(reportCounts.open) : UNKNOWN,
      delta: reportsResult.ok
        ? `${draftReports.length} draft · ${reviewReports.length} in review`
        : undefined,
      tone: "warning",
    },
    {
      id: "in-review",
      label: "In Review",
      value: reportsResult.ok ? String(reviewReports.length) : UNKNOWN,
      delta: reportsResult.ok ? "awaiting Manager" : undefined,
      tone: "muted",
    },
    {
      id: "completed",
      label: "Completed",
      value: reportCounts ? String(reportCounts.exported) : UNKNOWN,
      delta: reportCounts ? "exported to DOCX" : undefined,
      tone: "muted",
    },
    {
      id: "visits-this-month",
      label: "Visits This Month",
      value: reportsResult.ok ? String(monthVisits.length) : UNKNOWN,
      delta: monthProvinces.length > 0 ? monthProvinces.join(" · ") : undefined,
      tone: "muted",
    },
    {
      id: "visits-this-year",
      label: "Visits This Year",
      value: reportsResult.ok ? String(yearVisits.length) : UNKNOWN,
      delta:
        yearProvinces.length > 0
          ? `${yearProvinces.length} ${plural(yearProvinces.length, "province")} · ${thisYear}`
          : undefined,
      tone: "muted",
    },
  ];

  return (
    <PageShell>
      <PageHeader
        kicker="Global Sourcing Office · ODM Activities"
        title="Dashboard"
        subtitle={supplierLine ? `${dateLine} · ${supplierLine}` : dateLine}
        spacing={22}
        actions={
          <>
            <ButtonLink href="/suppliers/new" variant="secondary" icon="plus">
              Add Supplier
            </ButtonLink>
            <ButtonLink href="/reports/new" variant="primary" icon="plus">
              New Visit Report
            </ButtonLink>
          </>
        }
      />

      <KpiGrid>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            deltaTone={kpi.tone}
          />
        ))}
      </KpiGrid>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.85fr) minmax(300px,1fr)",
          gap: "22px",
          alignItems: "start",
        }}
      >
        <div>
          <SectionHeader
            title="Recent Reports"
            action={
              <ButtonLink
                href="/reports"
                variant="ghost"
                trailingIcon="right"
                style={{ fontSize: "11.5px" }}
              >
                {reportCounts ? `View all ${reportCounts.total}` : "View all"}
              </ButtonLink>
            }
          />
          <RecentReports reports={recentReports} error={reportsError} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div>
            <SectionHeader title="Reports Requiring Attention" />
            <AttentionList items={attentionItems} error={reportsError} />
          </div>
          <div>
            <SectionHeader title="Upcoming / Recent Visits" />
            <VisitList visits={visitItems} error={reportsError} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
