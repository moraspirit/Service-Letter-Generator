"use client";

import { useActionState } from "react";
import { Banner, Button } from "@moraspirit/ui";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="ms-field">
        <label className="ms-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="ms-input"
        />
      </div>

      <div className="ms-field">
        <label className="ms-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="ms-input"
        />
      </div>

      {/* Deliberately generic: the message never reveals whether the account exists. */}
      {state.error ? (
        <Banner tone="bad" role="alert">
          {state.error}
        </Banner>
      ) : null}

      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
