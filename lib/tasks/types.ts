export type OperationalTaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type OperationalTaskPriority = "low" | "normal" | "high" | "urgent";
export type OperationalTaskSource = "manual" | "conversation_followup" | "document_followup" | "system_alert";
export type OperationalTaskEventType = "created" | "updated" | "status_changed" | "note";

export interface OperationalTask {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  conversation_id: string | null;
  document_id: string | null;
  created_by: string;
  assigned_to: string | null;
  source: OperationalTaskSource;
  title: string;
  description: string;
  status: OperationalTaskStatus;
  priority: OperationalTaskPriority;
  due_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperationalTaskListItem extends OperationalTask {
  assigned_name: string | null;
  patient_label: string | null;
  conversation_label: string | null;
  document_title: string | null;
}

export interface OperationalTaskEvent {
  id: string;
  task_id: string;
  clinic_id: string;
  event_type: OperationalTaskEventType;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  author_name: string | null;
}

export interface OperationalAlert {
  id: string;
  kind: "conversation" | "document";
  title: string;
  description: string;
  patient_id: string | null;
  patient_label: string | null;
  conversation_id: string | null;
  document_id: string | null;
  stalled_since: string;
  suggested_priority: OperationalTaskPriority;
}
