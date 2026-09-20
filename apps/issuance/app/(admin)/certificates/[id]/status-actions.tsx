"use client";

import { useActionState } from "react";
import { Banner, Button, Card, CardBody, CardHead } from "@moraspirit/ui";
import { restoreAction, revokeAction, type StatusActionState } from "./actions";

const initial: StatusActionState = {};

/**
 * Revoke (for an active certificate) or restore (for a revoked one), each with a
 * required reason.
 *
 * Revoking sits in a bordered danger area with an outline button; the primary
 * red fill is reserved for the action a screen is *for*, so the two can never be
 * mistaken for each other. The typed reason is the real safeguard.
 */
export function StatusActions({
  certificateId,
  status,
}: {
  certificateId: string;
  status: "active" | "revoked";
}) {
  const revoking = status === "active";
  const [state, action, pending] = useActionState(revoking ? revokeAction : restoreAction, initial);

  const body = (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="certificateId" value={certificateId} />
      <div className="ms-field">
        <label htmlFor="status-reason" className="ms-label">
          Reason
          <span className="ms-required" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="status-reason"
          name="reason"
          className="ms-textarea"
          rows={2}
          maxLength={500}
          required
          aria-describedby="status-reason-help"
        />
        <p className="ms-help" id="status-reason-help">
          {revoking
            ? "Recorded in the history. It is never shown on the public page — a visitor only sees that the certificate was revoked, and when."
            : "Recorded in the history. The earlier revocation stays in the trail."}
        </p>
      </div>

      {state.error ? (
        <Banner tone="bad" role="alert">
          {state.error}
        </Banner>
      ) : null}

      <div>
        <Button
          type="submit"
          variant={revoking ? "danger" : "secondary"}
          size="sm"
          disabled={pending}
        >
          {pending ? "Saving…" : revoking ? "Revoke this certificate" : "Restore this certificate"}
        </Button>
      </div>
    </form>
  );

  if (!revoking) {
    return (
      <Card>
        <CardHead title="Restore" />
        <CardBody>{body}</CardBody>
      </Card>
    );
  }

  return (
    <section className="ms-danger">
      <h2 className="ms-danger-head">Revoke</h2>
      <div className="ms-card-body">
        <p className="ms-help ms-danger-lede">
          Anyone scanning this letter&apos;s QR code will be told it is no longer valid. The
          certificate is not deleted and can be restored.
        </p>
        {body}
      </div>
    </section>
  );
}
