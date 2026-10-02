/**
 * Turning a pasted block of notes into §6's key points.
 *
 * People do not write key points one at a time into a form. They arrive as a
 * block — out of a phone's notes app, a notebook, a transcript, an email to
 * yourself, a Word document — and §6 offered only "Add bullet", which made
 * pasting the information from a visit impossible.
 *
 * Its own module because the rule is worth testing on its own and the section
 * that uses it is a Client Component inside a tree that reaches `server-only`.
 */

/**
 * Bullet characters a notes app leaves at the front of each line are stripped:
 * a list copied out of Notes or Word otherwise arrives with "• " printed inside
 * every bullet, under the bullet the report already draws. The space after the
 * marker is required, so a dash *inside* a sentence survives — "Lead time —
 * four weeks" is one key point, not a marker and a sentence.
 */
const LEADING_MARKER = /^\s*[-*•·–—]\s+/;

/**
 * Blank lines win when there are any.
 *
 * Two kinds of text get pasted here and they want opposite rules. Notes typed
 * one point per line want one bullet per line. Prose copied out of Word, a PDF
 * or an email arrives as paragraphs separated by a blank line, and there each
 * paragraph is one point — splitting that on every newline would chop a single
 * sentence into three bullets wherever the source happened to wrap.
 *
 * So: if the text contains a blank line, the blank lines are the boundaries and
 * the wrapping inside a block is kept. If it does not, every line is a bullet.
 */
export function bulletsFromPaste(text: string): string[] {
  const normalised = text.replace(/\r\n/g, "\n");
  const byParagraph = /\n[ \t]*\n/.test(normalised);

  return normalised
    .split(byParagraph ? /\n[ \t]*\n+/ : /\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.replace(LEADING_MARKER, "").trim())
        .filter((line) => line !== "")
        .join("\n"),
    )
    .filter((block) => block !== "");
}
