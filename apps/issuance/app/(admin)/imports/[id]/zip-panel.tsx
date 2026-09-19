"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
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

export function ZipPanel({ batchId, status, rendered, total, expiresAt, report }: ZipPanelProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateZipAction, idle);
  const busy = status === "queued" || status === "generating";

  // Poll the server while a job runs; the page re-renders with fresh progress.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [busy, router]);

  return (
    <section className="flex flex-col gap-3" aria-label="ZIP export">
      <h2 className="text-lg font-semibold">Download all as ZIP</h2>
      <p className="text-sm text-zinc-700" role="status">
        {STATUS_TEXT[status]}
        {busy || status === "ready" ? ` ${rendered} of ${total} letters rendered.` : ""}
      </p>
      {busy ? (
        <progress className="w-full max-w-md" value={rendered} max={Math.max(total, 1)} />
      ) : null}
      {status === "ready" && expiresAt ? (
        <p className="text-sm text-zinc-600">
          Available until {expiresAt.slice(0, 16).replace("T", " ")} UTC, then deleted.
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        {status === "ready" ? (
          <a
            href={`/imports/${batchId}/zip`}
            className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white"
          >
            Download ZIP
          </a>
        ) : null}
        {!busy ? (
          <form action={action}>
            <input type="hidden" name="batchId" value={batchId} />
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "none" ? "Generate ZIP" : "Generate again"}
            </button>
          </form>
        ) : null}
      </div>

      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.message}
        </p>
      ) : null}

      {report.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">
            {report.length} {report.length === 1 ? "certificate" : "certificates"} left out of the
            ZIP:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {report.map((entry) => (
              <li key={entry.certificateId}>
                <a href={`/certificates/${entry.certificateId}`} className="underline">
                  {entry.memberId || entry.certificateId.slice(0, 8)}
                </a>
                : {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
