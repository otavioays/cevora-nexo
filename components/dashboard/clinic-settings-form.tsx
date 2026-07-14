"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

export function ClinicSettingsForm({ clinicId, initialName, initialSlug, canEdit }: { clinicId: string; initialName: string; initialSlug: string; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("clinics")
        .update({ name: name.trim(), slug })
        .eq("id", clinicId);
      if (updateError) throw updateError;
      setSuccess("Dados da clínica atualizados.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="clinic-name">Nome</label>
        <input className="input" id="clinic-name" disabled={!canEdit} required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="clinic-slug">Identificador</label>
        <input className="input" id="clinic-slug" disabled={!canEdit} required pattern="[a-z0-9-]+" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
      </div>
      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
      {canEdit ? (
        <button className="button button-primary" type="submit" disabled={loading}>
          <Save size={16} /> {loading ? "Salvando..." : "Salvar alterações"}
        </button>
      ) : (
        <div className="form-info">Seu papel permite visualizar, mas não alterar os dados da clínica.</div>
      )}
    </form>
  );
}
