import type { Metadata } from "next";
import { ShieldCheck, Users } from "lucide-react";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { InvitationActions } from "@/components/team/invitation-actions";
import { MemberActions } from "@/components/team/member-actions";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMembership } from "@/lib/auth";
import { INVITATION_STATUS_LABELS, MEMBER_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { ClinicInvitation, MemberWithProfile } from "@/lib/types";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipe" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { user, activeMembership } = await requireMembership();
  const canManage = activeMembership.role === "owner" || activeMembership.role === "manager";
  const supabase = await createClient();

  const [{ data: memberRows }, { data: invitationRows }] = await Promise.all([
    supabase
      .from("clinic_members")
      .select("id, clinic_id, user_id, role, status, created_at, updated_at, profile:profiles!clinic_members_user_id_fkey(*)")
      .eq("clinic_id", activeMembership.clinic_id)
      .order("created_at", { ascending: true }),
    canManage
      ? supabase
          .from("clinic_invitations")
          .select("*")
          .eq("clinic_id", activeMembership.clinic_id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const members = (memberRows ?? []) as unknown as MemberWithProfile[];
  const invitations = (invitationRows ?? []) as ClinicInvitation[];

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Pessoas e permissões</span>
          <h1>Equipe</h1>
          <p>
            Cada pessoa usa seu próprio acesso. Papéis delimitam o que pode ser visto e alterado,
            sem senhas compartilhadas circulando pelos corredores.
          </p>
        </div>
        <StatusPill tone="gold"><Users size={13} /> {members.length} membro(s)</StatusPill>
      </header>

      {canManage ? (
        <InviteMemberForm clinicId={activeMembership.clinic_id} actorRole={activeMembership.role} />
      ) : (
        <div className="permission-note"><ShieldCheck size={18} /> Somente proprietários e gestores podem criar convites ou alterar a equipe.</div>
      )}

      <section className="table-card" style={{ marginTop: "1rem" }}>
        <div className="table-header">
          <div><h2>Membros</h2><span className="card-description">Acessos ativos e desativados da clínica.</span></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Pessoa</th><th>Papel</th><th>Status</th><th>Desde</th><th>Ações</th></tr></thead>
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
                  <td><StatusPill tone={member.status === "active" ? "success" : "danger"}>{MEMBER_STATUS_LABELS[member.status]}</StatusPill></td>
                  <td>{formatDate(member.created_at)}</td>
                  <td>
                    {canManage ? (
                      <MemberActions
                        memberId={member.id}
                        memberRole={member.role}
                        memberStatus={member.status}
                        actorRole={activeMembership.role}
                        isSelf={member.user_id === user.id}
                      />
                    ) : <span style={{ color: "var(--muted)" }}>Sem ações</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && (
        <section className="table-card" style={{ marginTop: "1rem" }}>
          <div className="table-header"><div><h2>Convites</h2><span className="card-description">Links emitidos para novos membros.</span></div></div>
          {invitations.length === 0 ? (
            <div className="empty-state">Nenhum convite foi criado ainda.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>E-mail</th><th>Papel</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead>
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
      )}
    </>
  );
}
