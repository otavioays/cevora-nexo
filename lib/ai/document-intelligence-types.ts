import type { PatientDocumentType } from "@/lib/types";

export type DocumentReadability = "clear" | "acceptable" | "poor" | "unreadable";
export type DocumentFieldStatus = "present" | "missing" | "unclear" | "not_applicable";
export type DocumentAiRecommendation =
  | "ready_for_human_review"
  | "request_better_file"
  | "manual_specialist_review";

export interface DocumentFieldCheck {
  field: string;
  status: DocumentFieldStatus;
  note: string;
}

export interface DocumentIntelligenceResult {
  classification: {
    suggested_type: PatientDocumentType;
    confidence: number;
    rationale: string;
  };
  visual_quality: {
    readability: DocumentReadability;
    issues: string[];
  };
  review_summary: string;
  field_checks: DocumentFieldCheck[];
  alerts: string[];
  recommendation: DocumentAiRecommendation;
  suggested_send_message: string;
  human_review_required: true;
  limitations: string[];
}

export interface PatientDocumentAiAnalysis {
  id: string;
  document_id: string;
  patient_id: string;
  clinic_id: string;
  requested_by: string;
  provider: string;
  model: string;
  privacy_confirmation: "fictitious_or_anonymized";
  result: DocumentIntelligenceResult;
  created_at: string;
}
