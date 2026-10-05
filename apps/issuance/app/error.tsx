"use client";

import { ProblemPage } from "./_components/problem-page";

// Catches a failure in the admin layout itself (its session check reads the database) and in
// pages outside the admin shell. Failures inside a page are caught by (admin)/error.tsx, which
// keeps the navigation on screen.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <ProblemPage digest={error.digest} reset={reset} />
    </main>
  );
}
