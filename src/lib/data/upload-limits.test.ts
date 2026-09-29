import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import { MAX_UPLOAD_BYTES, SERVER_ACTION_BODY_LIMIT_BYTES } from "./upload-limits";
import { MAX_TEMPLATE_BYTES } from "./template-limits";

/**
 * Every file in this app is uploaded as an argument to a Server Action, so the
 * file limits the pickers advertise are only real if the transport can carry
 * them.
 *
 * It could not. Next caps a Server Action request body at 1 MB unless the
 * config says otherwise, and it enforces that cap by THROWING `ApiError(413)`
 * — an exception, not a `DataResult`. So the 1.6 MB corporate template passed
 * the picker's 25 MB check, was refused by the transport, and the throw tore
 * the page down into `(app)/error.tsx`: "The server is not responding",
 * reference `778281220@E394`. E394 is Next's own code for that ApiError.
 *
 * These are the invariants that would have caught it.
 */
describe("upload limits fit the transport that carries them", () => {
  it("configures Next's Server Action body limit explicitly", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(
      SERVER_ACTION_BODY_LIMIT_BYTES,
    );
  });

  it("stays under Vercel's own 4.5 MB ceiling for a function request", () => {
    // Proven against production: a 6 MB POST never reaches Next at all, it
    // comes back as Vercel's `FUNCTION_PAYLOAD_TOO_LARGE`. Raising the Next
    // limit past this would only move the crash one layer out.
    expect(SERVER_ACTION_BODY_LIMIT_BYTES).toBeLessThanOrEqual(4.5 * 1000 * 1000);
  });

  it.each([
    ["a photograph", MAX_UPLOAD_BYTES],
    ["the Word template", MAX_TEMPLATE_BYTES],
  ])("accepts %s only at a size the body limit can carry", (_what, limit) => {
    expect(limit).toBeLessThan(SERVER_ACTION_BODY_LIMIT_BYTES);
  });

  it("leaves room for multipart boundaries and the action's own fields", () => {
    // The limit applies to the raw request, not to the file: boundaries, part
    // headers and the other arguments are counted too.
    const headroom = SERVER_ACTION_BODY_LIMIT_BYTES - Math.max(MAX_UPLOAD_BYTES, MAX_TEMPLATE_BYTES);
    expect(headroom).toBeGreaterThanOrEqual(64 * 1024);
  });
});
