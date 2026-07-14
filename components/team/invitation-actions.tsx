"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function InvitationActions({ invitationId, token }: { invitationId: string; token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/convite/${token}`);
    setCopied(true);
  }

  async function revoke() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("revoke_clinic_invitation", { p_invitation_id: invitationId });
      if (error) throw error;
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-actions">
      <button className="button button-secondary button-small" type="button" onClick={copy}>
        <Copy size={14} /> {copied ? "Copiado" : "Copiar"}
      </button>
      <button className="button button-danger button-small" type="button" onClick={revoke} disabled={loading}>
        <X size={14} /> Revogar
      </button>
    </div>
  );
}
