"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

// One message for every failure (unknown email, wrong password, throttled) so the
// response never reveals which emails exist or that an account is being throttled.
const FAILED: LoginState = {
  error:
    "Sign-in failed. Check your email and password. After several failed attempts, sign-in is paused for 15 minutes.",
};

// A failure that is not a credentials problem, most often the database being unreachable while
// the password is looked up. Saying "check your password" then would send the admin the wrong
// way, and it reveals nothing about any account.
const UNAVAILABLE: LoginState = {
  error:
    "Sign-in is unavailable right now. Nothing is wrong with your password. Try again in a minute.",
};

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    // signIn redirects on success by throwing; only authentication failures are ours to handle.
    if (error instanceof AuthError) {
      return error.type === "CredentialsSignin" ? FAILED : UNAVAILABLE;
    }
    throw error;
  }
  return {};
}
