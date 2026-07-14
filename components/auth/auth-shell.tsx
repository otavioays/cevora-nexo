import { Logo } from "@/components/ui/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-layout">
      <aside className="auth-aside">
        <Logo />
        <div className="auth-copy">
          <span className="eyebrow">Fundação segura</span>
          <h1>Uma clínica por ambiente. Nenhum dado atravessa a parede.</h1>
          <p>
            A primeira iteração do Nexo organiza acesso, papéis e isolamento entre clínicas
            antes de ligar o motor de inteligência comercial.
          </p>
        </div>
        <small style={{ color: "var(--muted)" }}>CEVORA NEXO · ITERAÇÃO 01</small>
      </aside>
      <section className="auth-main">{children}</section>
    </main>
  );
}
