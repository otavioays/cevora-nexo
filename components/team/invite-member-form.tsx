"use client";

import { useState } from "react";
import { Copy, Link2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ClinicRole } from "@/lib/types";

export function InviteMemberForm({ clinicId, actorRole }: { clinicId: string; actorRole: ClinicRole }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClinicRole>("attendant");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInviteUrl(null);
    setCopied(false);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_clinic_invitation", {
        p_clinic_id: clinicId,
        p_email: email.trim().toLowerCase(),
        p_role: role,
      });
      if (rpcError) throw rpcError;
      const token = String(data);
      setInviteUrl(`${window.location.origin}/convite/${token}`);
      setEmail("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar o convite.");
    } finally {
      setLoading(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <div className="card">
      <h2>Convidar membro</h2>
      <p className="card-description">
        O sistema gera um link vinculado ao e-mail. A pessoa precisa entrar com o mesmo endereço para aceitar.
      </p>
      <form className="invite-grid" onSubmit={handleSubmit}>
        <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="atendente@clinica.com.br" />
        <select className="select" value={role} onChange={(event) => setRole(event.target.value as ClinicRole)}>
          <option value="attendant">Atendente</option>
          <option value="manager">Gestor</option>
          {actorRole === "owner" && <option value="owner">Proprietário</option>}
        </select>
        <button className="button button-primary" type="submit" disabled={loading}>
          <Send size={16} /> {loading ? "Criando..." : "Gerar convite"}
        </button>
      </form>
      {error && <div className="form-error" style={{ marginTop: "1rem" }}>{error}</div>}
      {inviteUrl && (
        <div className="invite-result">
          <strong><Link2 size={15} /> Link pronto para compartilhar</strong>
          <div className="copy-row">
            <input className="input" readOnly value={inviteUrl} aria-label="Link de convite" />
            <button className="button button-secondary" type="button" onClick={copyInvite}>
              <Copy size={16} /> {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
