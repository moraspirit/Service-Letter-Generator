import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · MoraSpirit Certificates" };

export default function LoginPage() {
  return (
    <main className="ms-login">
      <div className="ms-login-card">
        <div className="ms-login-head">
          <p className="ms-wordmark">
            MoraSpirit <span>Certificates</span>
          </p>
          <h1 className="ms-login-title">Administrator sign-in</h1>
          <p className="ms-login-sub">
            This panel issues and manages service letters. Certificate verification is a separate,
            public site and does not need an account.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
