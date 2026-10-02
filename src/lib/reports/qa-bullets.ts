/**
 * Turning a pasted block of notes into §6's key points.
 *
 * One line, one bullet. People do not write key points one at a time into a
 * form — they arrive as a block, out of a phone's notes app, a notebook, a
 * transcript, an email to themselves — and §6 offered only "Add bullet", which
 * made pasting the information from a visit impossible.
 *
 * Its own module because the rule is worth testing on its own and the section
 * that uses it is a Client Component inside a tree that reaches `server-only`.
 */

/**
 * Bullet characters a notes app leaves at the front of each line are stripped:
 * a list copied out of Notes or Word otherwise arrives with "• " printed inside
 * every bullet, under the bullet the report already draws. A dash *inside* the
 * sentence is left alone — "Lead time — four weeks" is one key point, not a
 * marker and a sentence.
 */
const LEADING_MARKER = /^\s*[-*\u2022\u00b7\u2013\u2014]\s+/;

export function bulletsFromPaste(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_MARKER, "").trim())
    .filter((line) => line !== "");
}
