import type { Metadata } from "next";

import { AttentionList } from "@/components/dashboard/attention-list";
import { RecentReports } from "@/components/dashboard/recent-reports";
import { VisitList } from "@/components/dashboard/visit-list";
import { ButtonLink } from "@/components/ui/button";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import {
  PageHeader,
  PageShell,
  SectionHeader,
} from "@/components/ui/page-header";
import {
  DASHBOARD_ATTENTION,
  DASHBOARD_DATE_LINE,
  DASHBOARD_KPIS,
  DASHBOARD_VISITS,
  REPORTS,
} from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard — README §1.2, prototype lines 181..270, screenshot
 * `01-dashboard.png`.
 *
 * Page padding 26px 24px 40px; header (kicker, title, date line, Add Supplier +
 * New Visit Report); the 6-up KPI strip; then the two-column body
 * `minmax(0,1.85fr) minmax(300px,1fr)` at 22px, recent reports on the left and
 * the attention / visits column on the right.
 *
 * **[INFERRED]** — New Visit Report points at `/reports/new`, the route README
 * §1 and §25 give the two-step modal. A Server Component cannot open the shell's
 * modal state, and a link is the right affordance for a modal route.
 */
export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader
        kicker="Global Sourcing Office · ODM Activities"
        title="Dashboard"
        subtitle={DASHBOARD_DATE_LINE}
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
        {DASHBOARD_KPIS.map((kpi) => (
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
                View all 18
              </ButtonLink>
            }
          />
          <RecentReports reports={REPORTS.slice(0, 5)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div>
            <SectionHeader title="Reports Requiring Attention" />
            <AttentionList items={DASHBOARD_ATTENTION} />
          </div>
          <div>
            <SectionHeader title="Upcoming / Recent Visits" />
            <VisitList visits={DASHBOARD_VISITS} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
