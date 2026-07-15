export const ROLE_LABELS = {
  owner: "Proprietário",
  manager: "Gestor",
  attendant: "Membro",
} as const;

export const OPERATIONAL_ROLE_LABELS = {
  attendant: "Atendimento",
  doctor: "Médico",
  administrative: "Administrativo",
} as const;

export const MEMBER_STATUS_LABELS = {
  active: "Ativo",
  inactive: "Inativo",
} as const;

export const INVITATION_STATUS_LABELS = {
  pending: "Pendente",
  accepted: "Aceito",
  revoked: "Revogado",
  expired: "Expirado",
} as const;

export const MANAGEMENT_ROLES = ["owner", "manager"] as const;
