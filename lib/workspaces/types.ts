import type { MemberWithProfile, Membership, Professional } from "@/lib/types";

export type ClinicOperationalRole = "attendant" | "doctor" | "administrative";
export type WorkspaceKind = "attendance" | "medical" | "management";

export interface WorkspaceMembership extends Membership {
  operational_role: ClinicOperationalRole;
  professional_id: string | null;
}

export interface WorkspaceMember extends MemberWithProfile {
  operational_role: ClinicOperationalRole;
  professional_id: string | null;
  professional?: Professional | null;
}
