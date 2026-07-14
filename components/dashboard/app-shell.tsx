"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenCheck, Building2, LayoutDashboard, LogOut, MessageSquareText, Settings, UserRound, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ROLE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Membership, Profile } from "@/lib/types";
import { initials } from "@/lib/utils";

const navigation = [
  { href: "/app", label: "Visão geral", icon: LayoutDashboard },
  { href: "/app/responder", label: "Conversas", icon: MessageSquareText },
  { href: "/app/pacientes", label: "Pacientes", icon: UserRound },
  { href: "/app/perfil-comercial", label: "Perfil comercial", icon: BookOpenCheck },
  { href: "/app/equipe", label: "Equipe", icon: Users },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({
  membership,
  profile,
  email,
  children,
}: {
  membership: Membership;
  profile: Profile | null;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Logo />
        <div className="clinic-switcher">
          <small>Ambiente ativo</small>
          <strong>{membership.clinic.name}</strong>
          <span style={{ color: "var(--gold)", fontSize: "0.7rem" }}>
            {ROLE_LABELS[membership.role]}
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = item.href === "/app" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} className={`nav-item ${active ? "nav-item-active" : ""}`} href={item.href}>
                <Icon size={17} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="user-card">
          <div className="avatar">{initials(profile?.display_name, email)}</div>
          <div className="user-meta">
            <strong>{profile?.display_name || "Usuário Nexo"}</strong>
            <span>{email}</span>
          </div>
          <button className="button button-ghost button-small" type="button" onClick={signOut} aria-label="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="app-main">
        <div className="mobile-topbar">
          <Logo />
          <div className="inline-actions">
            <Building2 size={16} />
            <strong style={{ fontSize: "0.82rem" }}>{membership.clinic.name}</strong>
            <button className="button button-ghost button-small" type="button" onClick={signOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
