"use client";

import Link from "next/link";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { SetupNotice } from "@/components/ui/setup-notice";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export function SignupForm({ nextPath }: { nextPath: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: callback,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.assign(nextPath);
        return;
      }

      setSuccess("Conta criada. Confira seu e-mail para confirmar o acesso.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      {!configured && <SetupNotice />}
      <h2>Crie seu acesso</h2>
      <p>Depois do cadastro, você poderá criar uma clínica ou aceitar um convite.</p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input className="input" id="name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome completo" />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input className="input" id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@clinica.com.br" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input className="input" id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" />
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
        <button className="button button-primary" type="submit" disabled={!configured || loading}>
          <UserPlus size={17} /> {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <div className="auth-footer">
        Já possui acesso? <Link className="text-link" href={`/login?next=${encodeURIComponent(nextPath)}`}>Entrar</Link>
      </div>
    </div>
  );
}
