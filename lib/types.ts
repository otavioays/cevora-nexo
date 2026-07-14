export type ClinicRole = "owner" | "manager" | "attendant";
export type MemberStatus = "active" | "inactive";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
  clinic: Clinic;
}

export interface MemberWithProfile {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
  profile: Profile | null;
}

export interface ClinicInvitation {
  id: string;
  clinic_id: string;
  email: string;
  role: ClinicRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export interface InvitationPreview {
  clinic_name: string;
  email: string;
  role: ClinicRole;
  status: InvitationStatus;
  expires_at: string;
}
