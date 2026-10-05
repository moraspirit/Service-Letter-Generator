"use client";

import Link from "next/link";
import { Button, EmptyState } from "@moraspirit/ui";

/**
 * What an admin sees when a page fails to load, most often because the database could not
 * be reached. It shows no error text: messages can carry file paths and connection details,
 * and the server log already has them. The digest lets the failure be found in that log.
 */
export function ProblemPage({ digest, reset }: { digest?: string; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl pt-8">
      <EmptyState
        icon="alert"
        title="This page could not load"
        action={
          <div className="ms-actions justify-center">
            <Button type="button" variant="primary" size="sm" onClick={reset}>
              Try again
            </Button>
            <Link href="/" className="ms-btn ms-btn-secondary ms-btn-sm">
              Go to the main page
            </Link>
          </div>
        }
      >
        The most common cause is that the database could not be reached for a moment. Nothing you
        have done has been lost or changed. Wait a few seconds and try again; if it keeps happening,
        the database or the network connection to it is down.
        {digest ? (
          <span className="ms-help block pt-2">
            Reference for the server log: <span className="ms-mono">{digest}</span>
          </span>
        ) : null}
      </EmptyState>
    </div>
  );
}
