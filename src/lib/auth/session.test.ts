import { describe, expect, it } from "vitest";

import { profileFromRow } from "@/lib/auth/session";

/**
 * The New Report form's Employee control offers exactly one option — the
 * signed-in user — and the field is required. A profile with no name therefore
 * renders an unselectable blank and no report can be created at all, which is
 * how this was found in production.
 *
 * `profiles.full_name` is `not null default ''`, so the empty case is `""`,
 * not null. `??` treats that as a value and skips every fallback behind it.
 */
describe("profileFromRow", () => {
  const user = { id: "u1", email: "reinaldo@ebara.com", user_metadata: {} };

  it("falls back past an empty stored name", () => {
    const profile = profileFromRow(user, {
      id: "u1",
      email: "reinaldo@ebara.com",
      full_name: "",
      job_title: null,
      initials: null,
      role: "admin",
    });

    expect(profile.fullName).not.toBe("");
    expect(profile.fullName).toBe("reinaldo");
  });

  it("falls back past a whitespace-only stored name", () => {
    const profile = profileFromRow(user, {
      id: "u1",
      email: "reinaldo@ebara.com",
      full_name: "   ",
      job_title: null,
      initials: null,
      role: "admin",
    });

    expect(profile.fullName).toBe("reinaldo");
  });

  it("prefers the stored name when there is one", () => {
    const profile = profileFromRow(user, {
      id: "u1",
      email: "reinaldo@ebara.com",
      full_name: "Reinaldo Alves",
      job_title: null,
      initials: null,
      role: "admin",
    });

    expect(profile.fullName).toBe("Reinaldo Alves");
  });

  it("uses the auth metadata name when the row has none", () => {
    const profile = profileFromRow(
      { ...user, user_metadata: { full_name: "Reinaldo Alves" } },
      { id: "u1", email: "reinaldo@ebara.com", full_name: "", job_title: null, initials: null, role: "editor" },
    );

    expect(profile.fullName).toBe("Reinaldo Alves");
  });

  it("never returns an empty name, even with nothing to work from", () => {
    const profile = profileFromRow({ id: "u1", email: "", user_metadata: {} }, null);

    expect(profile.fullName.trim().length).toBeGreaterThan(0);
  });

  it("derives initials rather than leaving the avatar blank", () => {
    const profile = profileFromRow(user, {
      id: "u1",
      email: "reinaldo@ebara.com",
      full_name: "",
      job_title: null,
      initials: null,
      role: "admin",
    });

    expect(profile.initials.trim().length).toBeGreaterThan(0);
  });
});
