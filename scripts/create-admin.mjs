/**
 * First administrator bootstrap — README §4.
 *
 *   npm run create-admin -- --email someone@ebara.com
 *
 * Every profile is created as a `viewer` by `handle_new_user()`, and only an
 * admin may promote another user. That is correct, and it leaves a new project
 * with nobody who can promote anybody: this script is the way out of that,
 * using the secret key, which is the one credential that bypasses RLS.
 *
 * It never sets a password. The user gets a Supabase invite or recovery link
 * and chooses their own, so no password is typed into a terminal, pasted into a
 * chat, or left in shell history.
 */

import { createClient } from "@supabase/supabase-js";

const PLACEHOLDERS = [
  "https://your-project-ref.supabase.co",
  "your-publishable-key",
  "your-secret-key",
];

function fatal(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || PLACEHOLDERS.includes(url)) {
  fatal("NEXT_PUBLIC_SUPABASE_URL is not set to a real project in .env.local.");
}
if (!secret || PLACEHOLDERS.includes(secret)) {
  fatal(
    "SUPABASE_SECRET_KEY is required. Promoting a user is exactly what row level\n" +
      "        security forbids, so this is one of the few places the secret key is the\n" +
      "        right answer. Copy it from Project Settings › API keys › secret.",
  );
}

const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
const email = emailIndex >= 0 ? args[emailIndex + 1]?.trim() : undefined;

if (args.includes("--help") || args.includes("-h") || !email) {
  console.log(`
  Promote a user to admin, inviting them first if they do not exist yet.

    npm run create-admin -- --email someone@ebara.com

  The address is not hardcoded anywhere and no password is ever set: Supabase
  emails an invitation and the user chooses their own.
`);
  process.exit(email ? 0 : 1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fatal(`"${email}" does not look like an email address.`);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`\n  ODM Supplier Visit — administrator bootstrap`);
console.log(`  target    ${url}`);
console.log(`  user      ${email}\n`);

// listUsers is paginated; an address is matched rather than assumed absent.
async function findUser(address) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fatal(`could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === address.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUser(email);

if (user) {
  console.log("  · user already exists — promoting");
} else {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) {
    fatal(
      `could not invite ${email}: ${error.message}\n\n` +
        "        If this project has no SMTP configured, create the user in the\n" +
        "        dashboard (Authentication › Users › Add user) and run this again —\n" +
        "        it will find them and promote them.",
    );
  }
  user = data.user;
  console.log("  · invitation sent — they choose their own password");
}

if (!user) fatal("the user could not be created or found.");

// handle_new_user() writes the profile on signup. An invited user who has not
// accepted yet may not have one, so the row is upserted rather than updated.
const { error: profileError } = await supabase
  .from("profiles")
  .upsert(
    { id: user.id, email, role: "admin" },
    { onConflict: "id" },
  );

if (profileError) {
  fatal(`the user exists but could not be promoted: ${profileError.message}`);
}

const { data: check } = await supabase
  .from("profiles")
  .select("role, full_name")
  .eq("id", user.id)
  .single();

console.log(`  · profile role is now "${check?.role}"`);
console.log(`\n  done. ${email} can administer this project once they sign in.\n`);
