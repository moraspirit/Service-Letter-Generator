"use client";

import { Button } from "@moraspirit/ui";
import { Verdict } from "./verify/[uuid]/verdict";

// The database could not be reached (or something else failed) while checking a certificate.
// This must never read as "not a valid certificate": a failed check says nothing about the
// letter, and a visitor holding a real one should be told to try again, not to doubt it.
export default function VerifyError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ms-verify-col flex flex-col gap-5">
      <Verdict
        tone="unknown"
        icon="alert"
        title="We could not check this certificate right now"
        note="This does not mean the certificate is invalid. The check itself did not complete."
      />
      <div className="flex flex-col gap-3">
        <p className="ms-verify-note">
          Wait a few seconds and try again. If it keeps failing, contact MoraSpirit at
          info@moraspirit.com and mention the time you tried.
        </p>
        <div>
          <Button type="button" variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
