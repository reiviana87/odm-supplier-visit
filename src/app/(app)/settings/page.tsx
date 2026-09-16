import { redirect } from "next/navigation";

/**
 * `/settings` has no screen of its own — README §1.18 opens on Profile, which
 * is the first tab of the approved rail.
 */
export default function SettingsPage() {
  redirect("/settings/profile");
}
