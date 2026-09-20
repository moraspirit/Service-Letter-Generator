"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  LinkButton,
  StatusPill,
  type Tone,
} from "@moraspirit/ui";
import { generateZipAction, type ZipActionState } from "./actions";

export interface ZipPanelProps {
  batchId: number;
  status: "none" | "queued" | "generating" | "ready" | "failed" | "expired";
  rendered: number;
  total: number;
  expiresAt: string | null;
  report: { certificateId: string; memberId: string; reason: string }[];
}

const idle: ZipActionState = { status: "idle" };

const STATUS_TEXT: Record<ZipPanelProps["status"], string> = {
  none: "No ZIP generated yet.",
  queued: "Waiting to start.",
  generating: "Generating.",
  ready: "Ready to download.",
  failed: "The last attempt failed.",
  expired: "The ZIP expired and was deleted. Generate it again if you still need it.",
};

const STATUS_PILL: Record<ZipPanelProps["status"], { tone: Tone; label: string }> = {
  none: { tone: "neutral", label: "Not generated" },
  queued: { tone: "info", label: "Queued" },
  generating: { tone: "info", label: "Generating" },
  ready: { tone: "ok", label: "Ready" },
  failed: { tone: "bad", label: "Failed" },
  expired: { tone: "neutral", label: "Expired" },
};

export function ZipPanel({ batchId, status, rendered, total, expiresAt, report }: ZipPanelProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateZipAction, idle);
  const busy = status === "queued" || status === "generating";
  const pill = STATUS_PILL[status];
  const pct = total > 0 ? Math.round((rendered / total) * 100) : 0;

  // Poll the server while a job runs; the page re-renders with fresh progress.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [busy, router]);

  return (
    <Card>
      <CardHead
        title="Download all as ZIP"
        actions={<StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
      />
      <CardBody>
        <div className="flex flex-col gap-4">
          <p className="ms-help" role="status">
            {STATUS_TEXT[status]}
            {busy || status === "ready" ? ` ${rendered} of ${total} letters rendered.` : ""}
          </p>

          {busy ? (
            <div
              className="ms-progress"
              role="progressbar"
              aria-valuenow={rendered}
              aria-valuemin={0}
              aria-valuemax={Math.max(total, 1)}
              aria-label="Letters rendered"
            >
              <div className="ms-progress-bar" style={{ width: `${pct}%` }} />
            </div>
          ) : null}

          {status === "ready" && expiresAt ? (
            <p className="ms-help">
              Available until {expiresAt.slice(0, 16).replace("T", " ")} UTC, then deleted from the
              server. Generate it again if you need it after that.
            </p>
          ) : null}

          {state.status === "error" ? (
            <Banner tone="bad" role="alert">
              {state.message}
            </Banner>
          ) : null}

          {report.length > 0 ? (
            <Banner
              tone="warn"
              title={`${report.length} ${report.length === 1 ? "certificate" : "certificates"} left out of the ZIP`}
            >
              <ul className="ms-dup-list">
                {report.map((entry) => (
                  <li key={entry.certificateId}>
                    <a href={`/certificates/${entry.certificateId}`} className="ms-link ms-mono">
                      {entry.memberId || entry.certificateId.slice(0, 8)}
                    </a>{" "}
                    — {entry.reason}
                  </li>
                ))}
              </ul>
            </Banner>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {status === "ready" ? (
              <LinkButton href={`/imports/${batchId}/zip`} variant="primary" icon="download">
                Download ZIP
              </LinkButton>
            ) : null}
            {!busy ? (
              <form action={action}>
                <input type="hidden" name="batchId" value={batchId} />
                <Button
                  type="submit"
                  variant={status === "ready" ? "ghost" : "secondary"}
                  disabled={pending}
                >
                  {status === "none" ? "Generate ZIP" : "Generate again"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
