import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Database, LockKeyhole, UserRoundCog } from "lucide-react";
import { ClinicSettingsForm } from "@/components/dashboard/clinic-settings-form";
import { requireManagement } from "@/lib/auth";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { activeMembership } = await requireManagement();

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <span className="eyebrow">Ambiente de Gestão</span>
          <h1>Configurações</h1>
          <p>Identidade técnica, regras administrativas e visão das proteções que sustentam a operação.</p>
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
            canEdit
          />
        </section>

        <section className="card">
          <h2>Conteúdo comercial</h2>
          <p className="card-description">Procedimentos, profissionais, regras e tom de voz permanecem sob controle da gestão.</p>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <Link className="button button-secondary" href="/app/perfil-comercial"><BookOpenCheck size={16} /> Abrir perfil comercial <ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="card">
          <h2>Camadas de segurança ativas</h2>
          <div className="section-stack">
            <div className="feature-row"><LockKeyhole size={18} /><div><strong>Rotas administrativas protegidas</strong><p>Equipe, configurações e perfil comercial exigem papel de proprietário ou gestor.</p></div></div>
            <div className="feature-row"><UserRoundCog size={18} /><div><strong>Função operacional independente</strong><p>Uma pessoa pode administrar a clínica e também atuar como médica sem compartilhar acessos.</p></div></div>
            <div className="feature-row"><Database size={18} /><div><strong>RLS e funções seguras</strong><p>Encaminhamentos são filtrados por gestão, solicitante, médico responsável e responsável pelo retorno.</p></div></div>
          </div>
        </section>
      </div>
    </>
  );
}
