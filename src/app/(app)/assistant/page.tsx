import type { Metadata } from "next";

import { AssistantPanel } from "@/components/ai/assistant-panel";

export const metadata: Metadata = {
  title: "AI Assistant",
};

/**
 * `/assistant` — README §1.13. The same assistant also appears as the 320px
 * editor rail; this route is its full-page form.
 */
export default function AssistantPage() {
  return <AssistantPanel />;
}
