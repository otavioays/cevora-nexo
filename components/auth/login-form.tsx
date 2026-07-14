"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { SetupNotice } from "@/components/ui/setup-notice";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = hasSupabaseEnv();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      {!configured && <SetupNotice />}
      <h2>Entre no Nexo</h2>
      <p>Use seu acesso individual para entrar no ambiente da clínica.</p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input className="input" id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@clinica.com.br" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input className="input" id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" />
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="button button-primary" type="submit" disabled={!configured || loading}>
          <LogIn size={17} /> {loading ? "Entrando..." : "Entrar"}
        </button>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <Link className="text-link" href="/recuperar-senha">Esqueci minha senha</Link>
        </div>
      </form>
      <div className="auth-footer">
        Ainda não possui acesso? <Link className="text-link" href={`/cadastro?next=${encodeURIComponent(nextPath)}`}>Criar conta</Link>
      </div>
    </div>
  );
}
