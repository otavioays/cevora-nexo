import type { Metadata } from "next";
import { Users } from "lucide-react";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { InvitationActions } from "@/components/team/invitation-actions";
import { MemberActions } from "@/components/team/member-actions";
import { StatusPill } from "@/components/ui/status-pill";
import { requireManagement } from "@/lib/auth";
import { INVITATION_STATUS_LABELS, MEMBER_STATUS_LABELS, OPERATIONAL_ROLE_LABELS, ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { ClinicInvitation, Professional } from "@/lib/types";
import type { WorkspaceMember } from "@/lib/workspaces/types";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { user, activeMembership } = await requireManagement();
  const supabase = await createClient();

  const [{ data: memberRows }, { data: invitationRows }, { data: professionalRows }] = await Promise.all([
    supabase
      .from("clinic_members")
      .select("id, clinic_id, user_id, role, operational_role, professional_id, status, created_at, updated_at, profile:profiles!clinic_members_user_id_fkey(*), professional:professionals(*)")
      .eq("clinic_id", activeMembership.clinic_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("clinic_invitations")
      .select("*")
      .eq("clinic_id", activeMembership.clinic_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("professionals")
      .select("*")
      .eq("clinic_id", activeMembership.clinic_id)
      .eq("active", true)
      .order("name"),
  ]);

  const members = (memberRows ?? []) as unknown as WorkspaceMember[];
  const invitations = (invitationRows ?? []) as ClinicInvitation[];
  const professionals = (professionalRows ?? []) as Professional[];

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Acesso administrativo e função operacional</span>
          <h1>Equipe</h1>
          <p>Defina separadamente quem administra a clínica e em qual ambiente cada pessoa executa o trabalho.</p>
        </div>
        <StatusPill tone="gold"><Users size={13} /> {members.length} membro(s)</StatusPill>
      </header>

      <InviteMemberForm clinicId={activeMembership.clinic_id} actorRole={activeMembership.role} />

      <div className="permission-note" style={{ marginTop: "1rem" }}>
        <Users size={18} /> Novos convites entram como membros de Atendimento. Depois do aceite, altere a função para Médico ou Administrativo e vincule o cadastro profissional quando necessário.
      </div>

      <section className="table-card" style={{ marginTop: "1rem" }}>
        <div className="table-header">
          <div><h2>Membros</h2><span className="card-description">Papel administrativo e função operacional são controles independentes.</span></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Pessoa</th><th>Acesso</th><th>Função</th><th>Status</th><th>Desde</th><th>Ações</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="member-cell">
                      <div className="avatar">{initials(member.profile?.display_name, member.profile?.email)}</div>
                      <div><strong>{member.profile?.display_name || "Usuário"}</strong><span>{member.profile?.email}</span></div>
                    </div>
                  </td>
                  <td><StatusPill tone={member.role === "owner" ? "gold" : "neutral"}>{ROLE_LABELS[member.role]}</StatusPill></td>
                  <td>
                    <StatusPill tone={member.operational_role === "doctor" ? "gold" : "neutral"}>{OPERATIONAL_ROLE_LABELS[member.operational_role]}</StatusPill>
                    {member.professional && <small style={{ display: "block", marginTop: 5, color: "var(--muted)" }}>{member.professional.name}</small>}
                  </td>
                  <td><StatusPill tone={member.status === "active" ? "success" : "danger"}>{MEMBER_STATUS_LABELS[member.status]}</StatusPill></td>
                  <td>{formatDate(member.created_at)}</td>
                  <td>
                    <MemberActions
                      memberId={member.id}
                      memberRole={member.role}
                      memberStatus={member.status}
                      operationalRole={member.operational_role}
                      professionalId={member.professional_id}
                      professionals={professionals}
                      actorRole={activeMembership.role}
                      isSelf={member.user_id === user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-card" style={{ marginTop: "1rem" }}>
        <div className="table-header"><div><h2>Convites</h2><span className="card-description">Links emitidos para novos membros.</span></div></div>
        {invitations.length === 0 ? (
          <div className="empty-state">Nenhum convite foi criado ainda.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>E-mail</th><th>Acesso</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{ROLE_LABELS[invitation.role]}</td>
                    <td><StatusPill tone={invitation.status === "pending" ? "warning" : invitation.status === "accepted" ? "success" : "danger"}>{INVITATION_STATUS_LABELS[invitation.status]}</StatusPill></td>
                    <td>{formatDate(invitation.expires_at)}</td>
                    <td>{invitation.status === "pending" ? <InvitationActions invitationId={invitation.id} token={invitation.token} /> : <span style={{ color: "var(--muted)" }}>Encerrado</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
