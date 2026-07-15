import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { activeMembership } = await requireMembership();

  if (activeMembership.role === "owner" || activeMembership.role === "manager") {
    redirect("/app/gestao");
  }

  if (activeMembership.operational_role === "doctor") {
    redirect("/app/medico");
  }

  redirect("/app/atendimento");
}
