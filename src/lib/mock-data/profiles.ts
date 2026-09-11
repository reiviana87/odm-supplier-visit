/**
 * People — the signed-in user shown in the sidebar footer, and the GSO members
 * listed in Settings › Members (README §13).
 *
 * Names, departments and roles come from the `memberRows` table of the approved
 * prototype (`design-handoff/ODM Supplier Visit.dc.html`, line 3113).
 */

import type { Profile } from "@/types/domain";

/** Rendered as "RA · Reinaldo Alves · ODM Business Development" in the sidebar. */
export const CURRENT_USER: Profile = {
  id: "user-reinaldo-alves",
  fullName: "Reinaldo Alves",
  email: "alves.reinaldo@ebara.com",
  jobTitle: "ODM Business Development",
  role: "admin",
  initials: "RA",
};

/** The Global Sourcing Office members, current user first. */
export const TEAM: Profile[] = [
  CURRENT_USER,
  {
    id: "user-corrado-braconi",
    fullName: "Corrado Braconi",
    email: "c.braconi@ebara.com",
    jobTitle: "Product Management",
    role: "manager",
    initials: "CB",
  },
  {
    id: "user-xu-jianping",
    fullName: "Xu Jianping",
    email: "xu.jianping@ebara.com",
    jobTitle: "Quality Engineering",
    role: "editor",
    initials: "XJ",
  },
  {
    id: "user-aiko-tanaka",
    fullName: "Aiko Tanaka",
    email: "a.tanaka@ebara.com",
    jobTitle: "Global Business Strategy",
    role: "viewer",
    initials: "AT",
  },
];
