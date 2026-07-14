import { AlertTriangle } from "lucide-react";

export function SetupNotice() {
  return (
    <div className="setup-notice" role="alert">
      <AlertTriangle size={18} />
      <div>
        <strong>Supabase ainda não configurado</strong>
        <p>
          Copie <code>.env.example</code> para <code>.env.local</code>, execute a migration e
          preencha as chaves do projeto.
        </p>
      </div>
    </div>
  );
}
