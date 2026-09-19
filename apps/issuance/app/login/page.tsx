import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · MoraSpirit Certificates" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">MoraSpirit Certificates</h1>
        <p className="mt-1 text-sm text-zinc-600">Administrator sign-in</p>
      </div>
      <LoginForm />
    </main>
  );
}
