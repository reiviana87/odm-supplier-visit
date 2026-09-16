import { LoadingState } from "@/components/ui/states";

/**
 * Route-level loading for the authenticated shell — README §1.2 ("loading
 * skeleton") and §23: skeleton blocks at the real element's size, never a page
 * spinner. `variant="page"` is the header + 6 KPI boxes + table shape the
 * dashboard resolves into.
 */
export default function AppLoading() {
  return <LoadingState variant="page" />;
}
