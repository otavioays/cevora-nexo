"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { SetupNotice } from "@/components/ui/setup-notice";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export function RecoveryForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = hasSupabaseEnv();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
      });
      if (recoveryError) throw recoveryError;
      setSuccess("Enviamos um link de redefinição para seu e-mail.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar o link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      {!configured && <SetupNotice />}
      <h2>Recuperar senha</h2>
      <p>Informe o e-mail cadastrado para receber um link seguro.</p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input className="input" id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@clinica.com.br" />
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
        <button className="button button-primary" type="submit" disabled={!configured || loading}>
          <Mail size={17} /> {loading ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    </div>
  );
}
