import type { NextConfig } from "next";

import { SERVER_ACTION_BODY_LIMIT_BYTES } from "./src/lib/data/upload-limits";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Every upload in this app — the corporate Word template, every
     * photograph — is an argument to a Server Action, and Next caps a Server
     * Action request body at 1 MB by default. It enforces that cap by throwing
     * `ApiError(413)`, which is not something an action can return and handle:
     * the throw escapes into `(app)/error.tsx` and replaces the page with
     * "The server is not responding". The 1.6 MB template did exactly that.
     *
     * The value is imported rather than written here so the limit the pickers
     * advertise and the limit the transport enforces cannot drift apart again;
     * `upload-limits.test.ts` holds them together.
     */
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_LIMIT_BYTES,
    },
  },
};

export default nextConfig;
