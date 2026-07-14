"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import type { InvitationPreview } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function InvitationCard({
  token,
  preview,
  authenticated,
  currentEmail,
}: {
  token: string;
  preview: InvitationPreview;
  authenticated: boolean;
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const nextPath = `/convite/${token}`;
  const emailMatches = currentEmail?.toLowerCase() === preview.email.toLowerCase();

  async function acceptInvitation() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("accept_clinic_invitation", { p_token: token });
      if (rpcError) throw rpcError;
      setAccepted(true);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível aceitar o convite.");
    } finally {
      setLoading(false);
    }
  }

  if (accepted) {
    return (
      <div className="invitation-card">
        <CheckCircle2 size={34} color="var(--green)" />
        <h1>Convite aceito.</h1>
        <p className="card-description">Seu acesso a {preview.clinic_name} já está ativo.</p>
        <Link className="button button-primary" href="/app">Entrar no ambiente <ArrowRight size={16} /></Link>
      </div>
    );
  }

  return (
    <div className="invitation-card">
      <ShieldCheck size={32} color="var(--gold)" />
      <span className="eyebrow" style={{ marginTop: "1.4rem" }}>Convite protegido</span>
      <h1>Você foi convidado para {preview.clinic_name}.</h1>
      <p className="card-description">
        Papel: <strong>{ROLE_LABELS[preview.role]}</strong><br />
        E-mail vinculado: <strong>{preview.email}</strong><br />
        Validade: <strong>{formatDate(preview.expires_at)}</strong>
      </p>

      {preview.status !== "pending" && (
        <div className="form-error">Este convite não está mais disponível. Status: {preview.status}.</div>
      )}

      {preview.status === "pending" && !authenticated && (
        <div className="form-actions" style={{ marginTop: "1.4rem" }}>
          <Link className="button button-primary" href={`/cadastro?next=${encodeURIComponent(nextPath)}`}>Criar conta</Link>
          <Link className="button button-secondary" href={`/login?next=${encodeURIComponent(nextPath)}`}>Já tenho conta</Link>
        </div>
      )}

      {preview.status === "pending" && authenticated && !emailMatches && (
        <div className="form-error">
          Você entrou como <strong>{currentEmail}</strong>, mas o convite foi emitido para <strong>{preview.email}</strong>.
        </div>
      )}

      {preview.status === "pending" && authenticated && emailMatches && (
        <div className="form-actions" style={{ marginTop: "1.4rem" }}>
          <button className="button button-primary" type="button" onClick={acceptInvitation} disabled={loading}>
            {loading ? "Aceitando..." : "Aceitar convite"} <ArrowRight size={16} />
          </button>
        </div>
      )}

      {error && <div className="form-error" style={{ marginTop: "1rem" }}>{error}</div>}
    </div>
  );
}
