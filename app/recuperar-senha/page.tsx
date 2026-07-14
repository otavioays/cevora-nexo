import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/recovery-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoveryPage() {
  return <AuthShell><RecoveryForm /></AuthShell>;
}
