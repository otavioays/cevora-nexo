"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess("Senha atualizada. Você já pode continuar para o painel.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Defina uma nova senha</h2>
      <p>Use pelo menos 8 caracteres e evite reutilizar uma senha antiga.</p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">Nova senha</label>
          <input className="input" id="password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="confirmation">Confirmar senha</label>
          <input className="input" id="confirmation" type="password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
        <button className="button button-primary" type="submit" disabled={loading}>
          <KeyRound size={17} /> {loading ? "Salvando..." : "Atualizar senha"}
        </button>
      </form>
    </div>
  );
}
