"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClinicRole, MemberStatus, Professional } from "@/lib/types";
import type { ClinicOperationalRole } from "@/lib/workspaces/types";

export function MemberActions({
  memberId,
  memberRole,
  memberStatus,
  operationalRole,
  professionalId,
  professionals,
  actorRole,
  isSelf,
}: {
  memberId: string;
  memberRole: ClinicRole;
  memberStatus: MemberStatus;
  operationalRole: ClinicOperationalRole;
  professionalId: string | null;
  professionals: Professional[];
  actorRole: ClinicRole;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOperationalRole, setNextOperationalRole] = useState<ClinicOperationalRole>(operationalRole);
  const [nextProfessionalId, setNextProfessionalId] = useState(professionalId ?? "");

  const canChangeRole = actorRole === "owner" || (actorRole === "manager" && memberRole === "attendant");
  const canChangeStatus = !isSelf && (actorRole === "owner" || (actorRole === "manager" && memberRole === "attendant"));
  const canChangeFunction = actorRole === "owner" || actorRole === "manager";

  async function updateRole(role: ClinicRole) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_clinic_member_role", {
        p_member_id: memberId,
        p_role: role,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Falha ao alterar papel administrativo.");
    } finally {
      setLoading(false);
    }
  }

  async function updateFunction() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_clinic_member_function", {
        p_member_id: memberId,
        p_operational_role: nextOperationalRole,
        p_professional_id: nextOperationalRole === "doctor" ? nextProfessionalId || null : null,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Falha ao alterar função operacional.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("set_clinic_member_status", {
        p_member_id: memberId,
        p_status: memberStatus === "active" ? "inactive" : "active",
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Falha ao alterar status.");
    } finally {
      setLoading(false);
    }
  }

  if (!canChangeRole && !canChangeStatus && !canChangeFunction) return <span style={{ color: "var(--muted)" }}>Sem ações</span>;

  return (
    <div className="section-stack" style={{ minWidth: 220 }}>
      {canChangeFunction && (
        <div className="inline-actions">
          <select className="select" style={{ minHeight: "2.25rem", width: 145, padding: "0.4rem" }} value={nextOperationalRole} disabled={loading} onChange={(event) => setNextOperationalRole(event.target.value as ClinicOperationalRole)}>
            <option value="attendant">Atendimento</option>
            <option value="doctor">Médico</option>
            <option value="administrative">Administrativo</option>
          </select>
          {nextOperationalRole === "doctor" && (
            <select className="select" style={{ minHeight: "2.25rem", width: 170, padding: "0.4rem" }} value={nextProfessionalId} disabled={loading} onChange={(event) => setNextProfessionalId(event.target.value)}>
              <option value="">Vincular profissional</option>
              {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
            </select>
          )}
          <button className="button button-secondary button-small" type="button" disabled={loading || (nextOperationalRole === "doctor" && !nextProfessionalId)} onClick={updateFunction}>
            Salvar função
          </button>
        </div>
      )}
      <div className="inline-actions">
        {canChangeRole && (
          <select className="select" style={{ minHeight: "2.25rem", width: 140, padding: "0.4rem" }} value={memberRole} disabled={loading} onChange={(event) => updateRole(event.target.value as ClinicRole)}>
            <option value="attendant">Membro</option>
            <option value="manager">Gestor</option>
            {actorRole === "owner" && <option value="owner">Proprietário</option>}
          </select>
        )}
        {canChangeStatus && (
          <button className={`button button-small ${memberStatus === "active" ? "button-danger" : "button-secondary"}`} type="button" onClick={toggleStatus} disabled={loading}>
            {memberStatus === "active" ? "Desativar" : "Reativar"}
          </button>
        )}
      </div>
      {error && <small style={{ display: "block", color: "var(--red)" }}>{error}</small>}
    </div>
  );
}
