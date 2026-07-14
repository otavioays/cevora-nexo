import type { Metadata } from "next";
import { Database, LockKeyhole, UserRoundCog } from "lucide-react";
import { ClinicSettingsForm } from "@/components/dashboard/clinic-settings-form";
import { requireMembership } from "@/lib/auth";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { activeMembership } = await requireMembership();
  const canEdit = activeMembership.role === "owner" || activeMembership.role === "manager";

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Ambiente da clínica</span>
          <h1>Configurações</h1>
          <p>Identidade básica do tenant e visão das proteções que sustentam esta primeira iteração.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="card">
          <h2>Dados da clínica</h2>
          <p className="card-description">O perfil comercial completo será construído na Iteração 2.</p>
          <ClinicSettingsForm
            clinicId={activeMembership.clinic.id}
            initialName={activeMembership.clinic.name}
            initialSlug={activeMembership.clinic.slug}
            canEdit={canEdit}
          />
        </section>

        <section className="card">
          <h2>Camadas de segurança ativas</h2>
          <div className="section-stack">
            <div className="feature-row"><LockKeyhole size={18} /><div><strong>Row Level Security</strong><p>Consultas são filtradas no banco, não apenas escondidas na interface.</p></div></div>
            <div className="feature-row"><UserRoundCog size={18} /><div><strong>Controle por papel</strong><p>Proprietário, gestor e atendente recebem poderes diferentes.</p></div></div>
            <div className="feature-row"><Database size={18} /><div><strong>Tenant em cada registro</strong><p>Os dados operacionais carregam o identificador da clínica desde a origem.</p></div></div>
          </div>
        </section>
      </div>
    </>
  );
}
