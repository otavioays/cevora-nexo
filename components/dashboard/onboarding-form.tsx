"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestedSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = slugTouched ? slug : suggestedSlug;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("create_clinic_with_owner", {
        p_name: name.trim(),
        p_slug: effectiveSlug,
      });
      if (rpcError) throw rpcError;
      router.replace("/app");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar a clínica.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="clinic-name">Nome da clínica</label>
        <input
          className="input"
          id="clinic-name"
          required
          minLength={2}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Clínica Aurora"
        />
      </div>
      <div className="field">
        <label htmlFor="clinic-slug">Identificador</label>
        <input
          className="input"
          id="clinic-slug"
          required
          minLength={2}
          pattern="[a-z0-9-]+"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
          placeholder="clinica-aurora"
        />
        <small style={{ color: "var(--muted)" }}>Usado internamente para identificar o ambiente.</small>
      </div>
      {error && <div className="form-error">{error}</div>}
      <button className="button button-primary" type="submit" disabled={loading || !effectiveSlug}>
        <Building2 size={17} /> {loading ? "Criando ambiente..." : "Criar clínica"} <ArrowRight size={16} />
      </button>
    </form>
  );
}
