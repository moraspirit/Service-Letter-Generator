import { Inngest } from "inngest";

/**
 * The Inngest client. In development it talks to the local Dev Server (`npx inngest-cli dev`),
 * which needs no account or keys. In production INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY come
 * from the environment (Phase 8).
 */
export const inngest = new Inngest({ id: "moraspirit-certificates" });

export const ZIP_REQUESTED_EVENT = "batch/zip.requested";
