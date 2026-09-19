// The state returned by the issue and edit Server Actions, shared with the form.
export type FormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Record<string, string> }
  | {
      status: "duplicate";
      existing: { id: string; state: "active" | "revoked"; issuedAt: string }[];
    }
  | { status: "overflow"; message: string; field: string | null }
  | { status: "render_failed"; message: string }
  | { status: "conflict" }
  | { status: "no_changes" }
  | { status: "wrong_state"; message: string };

/** A message for the states that are shown as a single red box. */
export function stateMessage(state: FormState): string | null {
  switch (state.status) {
    case "overflow":
    case "render_failed":
    case "wrong_state":
      return state.message;
    case "conflict":
      return "This certificate was changed by someone else after you opened it. Reload the page and apply your edit again.";
    case "no_changes":
      return "Nothing was changed.";
    default:
      return null;
  }
}
