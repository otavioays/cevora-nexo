import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getCurrentUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user } = await getCurrentUserContext();

  return (
    <main>
      <nav className="public-nav">
        <Logo />
        <div className="nav-actions">
          {user ? (
            <Link className="button button-primary" href="/app">
              Abrir plataforma <ArrowRight size={17} />
            </Link>
          ) : (
            <>
              <Link className="button button-secondary" href="/login">
                Entrar
              </Link>
              <Link className="button button-primary" href="/cadastro">
                Criar ambiente <ArrowRight size={17} />
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Inteligência comercial para clínicas</span>
          <h1>
            A próxima resposta deixa de ser <em>um palpite.</em>
          </h1>
          <p>
            O Cevora Nexo será o copiloto das atendentes: interpreta cada conversa, identifica
            o próximo movimento e gera respostas guiadas por SPIN Selling. Nesta primeira
            versão, construímos a fundação multi-clínica que mantém cada operação em seu próprio
            cofre.
          </p>
          <div className="inline-actions">
            <Link className="button button-primary" href={user ? "/app" : "/cadastro"}>
              {user ? "Ir ao painel" : "Começar a estruturar"} <ArrowRight size={17} />
            </Link>
            <Link className="button button-ghost" href="/login">
              Já tenho acesso
            </Link>
          </div>
        </div>

        <div className="hero-panel" aria-label="Prévia conceitual do motor Nexo">
          <div className="mock-window">
            <div className="mock-header">
              <div className="mock-dots"><span /><span /><span /></div>
              <span>NEXO · ANÁLISE</span>
            </div>
            <div className="mock-content">
              <div className="mock-message">“Quanto custa uma rinoplastia?”</div>
              <div className="mock-analysis">
                <strong><BrainCircuit size={14} /> Diagnóstico</strong>
                <span>Necessidade ainda implícita · investigar motivação antes de apresentar valor.</span>
              </div>
              <div className="mock-message mock-answer">
                “Claro. O investimento varia conforme cada caso. O que você gostaria de mudar no seu nariz hoje?”
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
