import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { Profile } from "@/lib/types";
import type { WorkspaceMembership } from "@/lib/workspaces/types";

export async function getCurrentUserContext() {
  if (!hasSupabaseEnv()) {
    return {
      user: null,
      profile: null as Profile | null,
      memberships: [] as WorkspaceMembership[],
      activeMembership: null as WorkspaceMembership | null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null as Profile | null,
      memberships: [] as WorkspaceMembership[],
      activeMembership: null as WorkspaceMembership | null,
    };
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("clinic_members")
      .select("id, clinic_id, user_id, role, operational_role, professional_id, status, created_at, updated_at, clinic:clinics(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  const normalizedMemberships = (memberships ?? []) as unknown as WorkspaceMembership[];

  return {
    user,
    profile: (profile ?? null) as Profile | null,
    memberships: normalizedMemberships,
    activeMembership: normalizedMemberships[0] ?? null,
  };
}

export async function requireUser(nextPath = "/app") {
  const context = await getCurrentUserContext();
  if (!context.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return context;
}

export async function requireMembership() {
  const context = await requireUser("/app");
  if (!context.activeMembership) {
    redirect("/onboarding");
  }
  return context as typeof context & { activeMembership: WorkspaceMembership };
}

export async function requireManagement() {
  const context = await requireMembership();
  if (context.activeMembership.role !== "owner" && context.activeMembership.role !== "manager") {
    redirect("/app/atendimento");
  }
  return context;
}

export async function requireMedicalWorkspace() {
  const context = await requireMembership();
  if (context.activeMembership.operational_role !== "doctor") {
    redirect(context.activeMembership.role === "owner" || context.activeMembership.role === "manager" ? "/app/gestao" : "/app/atendimento");
  }
  return context;
}

export async function requireAttendanceWorkspace() {
  const context = await requireMembership();
  const isManagement = context.activeMembership.role === "owner" || context.activeMembership.role === "manager";
  if (context.activeMembership.operational_role === "doctor" && !isManagement) {
    redirect("/app/medico");
  }
  return context;
}
