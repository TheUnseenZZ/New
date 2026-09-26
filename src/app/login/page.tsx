import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const unconfigured = !process.env.ADMIN_PASSWORD;
  return <LoginForm hint={unconfigured && process.env.NODE_ENV !== "production" ? "No ADMIN_PASSWORD set — dev password is “admin”." : undefined} />;
}
