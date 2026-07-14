import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { OnboardingForm } from "@/components/dashboard/onboarding-form";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const context = await requireUser("/onboarding");
  if (context.activeMembership) redirect("/app");

  return (
    <main className="centered-page">
      <section className="onboarding-card">
        <Logo />
        <span className="eyebrow" style={{ marginTop: "2rem" }}>Primeiro ambiente</span>
        <h1>Crie a casa digital da sua clínica.</h1>
        <p className="card-description">
          Você será registrado como proprietário. Depois poderá convidar gestores e atendentes,
          cada um com o acesso correto.
        </p>
        <OnboardingForm />
      </section>
    </main>
  );
}
