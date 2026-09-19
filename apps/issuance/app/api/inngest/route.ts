import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest calls this endpoint over HTTP and cannot hold an admin session, so proxy.ts leaves
// it out. In production it is protected by Inngest's request signature (INNGEST_SIGNING_KEY).
export const { GET, POST, PUT } = serve({ client: inngest, functions });
