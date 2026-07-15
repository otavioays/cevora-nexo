import type { OperationalTaskPriority } from "@/lib/tasks/types";

export type MedicalReferralStatus =
  | "pending"
  | "in_review"
  | "returned"
  | "approved_operationally"
  | "signed"
  | "cancelled";

export type MedicalReferralEventType = "created" | "assigned" | "status_changed" | "response" | "note";

export interface MedicalReferral {
  id: string;
  clinic_id: string;
  patient_id: string;
  document_id: string | null;
  conversation_id: string | null;
  requested_by: string;
  doctor_user_id: string;
  assigned_back_to: string | null;
  title: string;
  reason: string;
  medical_response: string;
  status: MedicalReferralStatus;
  priority: OperationalTaskPriority;
  due_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalReferralListItem extends MedicalReferral {
  patient_label: string;
  document_title: string | null;
  conversation_label: string | null;
  requester_name: string;
  doctor_name: string;
  assigned_back_name: string | null;
}

export interface MedicalReferralEvent {
  id: string;
  referral_id: string;
  clinic_id: string;
  event_type: MedicalReferralEventType;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  author_name: string | null;
}
