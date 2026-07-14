"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClinicRole, MemberStatus } from "@/lib/types";

export function MemberActions({
  memberId,
  memberRole,
  memberStatus,
  actorRole,
  isSelf,
}: {
  memberId: string;
  memberRole: ClinicRole;
  memberStatus: MemberStatus;
  actorRole: ClinicRole;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChangeRole = actorRole === "owner" || (actorRole === "manager" && memberRole === "attendant");
  const canChangeStatus = !isSelf && (actorRole === "owner" || (actorRole === "manager" && memberRole === "attendant"));

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
      setError(actionError instanceof Error ? actionError.message : "Falha ao alterar papel.");
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

  if (!canChangeRole && !canChangeStatus) return <span style={{ color: "var(--muted)" }}>Sem ações</span>;

  return (
    <div>
      <div className="inline-actions">
        {canChangeRole && (
          <select className="select" style={{ minHeight: "2.25rem", width: 140, padding: "0.4rem" }} value={memberRole} disabled={loading} onChange={(event) => updateRole(event.target.value as ClinicRole)}>
            <option value="attendant">Atendente</option>
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
      {error && <small style={{ display: "block", marginTop: 6, color: "var(--red)" }}>{error}</small>}
    </div>
  );
}
