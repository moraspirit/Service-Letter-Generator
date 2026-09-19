"use client";

import { useActionState } from "react";
import { restoreAction, revokeAction, type StatusActionState } from "./actions";

const initial: StatusActionState = {};

/** Revoke (for an active certificate) or restore (for a revoked one), each with a required reason. */
export function StatusActions({
  certificateId,
  status,
}: {
  certificateId: string;
  status: "active" | "revoked";
}) {
  const revoking = status === "active";
  const [state, action, pending] = useActionState(revoking ? revokeAction : restoreAction, initial);

  return (
    <form
      action={action}
      className="flex max-w-md flex-col gap-2 rounded border border-zinc-200 p-3"
    >
      <input type="hidden" name="certificateId" value={certificateId} />
      <label htmlFor="status-reason" className="text-sm font-medium">
        {revoking ? "Revoke this certificate" : "Restore this certificate"}
      </label>
      <textarea
        id="status-reason"
        name="reason"
        rows={2}
        maxLength={500}
        required
        placeholder="Reason (required, recorded in the history)"
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
      />
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`w-fit rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
          revoking ? "bg-red-700" : "bg-green-700"
        }`}
      >
        {pending ? "Saving…" : revoking ? "Revoke" : "Restore"}
      </button>
    </form>
  );
}
