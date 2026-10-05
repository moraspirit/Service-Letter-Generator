"use client";

import { ProblemPage } from "../_components/problem-page";

// A page inside the admin shell failed (typically a database query). The top bar stays, so
// the admin can go elsewhere or retry.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ProblemPage digest={error.digest} reset={reset} />;
}
