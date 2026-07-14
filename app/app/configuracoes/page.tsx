import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Database, LockKeyhole, UserRoundCog } from "lucide-react";
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
          <p>Identidade técnica do ambiente e visão das proteções que sustentam os dados comerciais.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="card">
          <h2>Dados do ambiente</h2>
          <p className="card-description">Nome e identificador técnico usados para separar esta clínica das demais.</p>
          <ClinicSettingsForm
            clinicId={activeMembership.clinic.id}
            initialName={activeMembership.clinic.name}
            initialSlug={activeMembership.clinic.slug}
            canEdit={canEdit}
          />
        </section>

        <section className="card">
          <h2>Conteúdo comercial</h2>
          <p className="card-description">Procedimentos, profissionais, regras e tom de voz agora vivem em uma área própria.</p>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-secondary" href="/app/perfil-comercial"><BookOpenCheck size={16} /> Abrir perfil comercial <ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="card">
          <h2>Camadas de segurança ativas</h2>
          <div className="section-stack">
            <div className="feature-row"><LockKeyhole size={18} /><div><strong>Row Level Security</strong><p>Consultas são filtradas no banco, não apenas escondidas na interface.</p></div></div>
            <div className="feature-row"><UserRoundCog size={18} /><div><strong>Controle por papel</strong><p>Proprietário e gestor editam; atendentes consultam o contexto aprovado.</p></div></div>
            <div className="feature-row"><Database size={18} /><div><strong>Tenant em cada registro</strong><p>Todo procedimento, regra e resposta aprovada carrega o identificador da clínica.</p></div></div>
          </div>
        </section>
      </div>
    </>
  );
}
