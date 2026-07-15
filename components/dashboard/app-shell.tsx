"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  FileLock2,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageSquareText,
  Settings,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { WorkspaceKind, WorkspaceMembership } from "@/lib/workspaces/types";
import { initials } from "@/lib/utils";

const WORKSPACE_LABELS: Record<WorkspaceKind, string> = {
  attendance: "Atendimento",
  medical: "Médico",
  management: "Gestão",
};

const WORKSPACE_HOME: Record<WorkspaceKind, string> = {
  attendance: "/app/atendimento",
  medical: "/app/medico",
  management: "/app/gestao",
};

const navigation = {
  attendance: [
    { href: "/app/atendimento", label: "Hoje", icon: LayoutDashboard, shared: false },
    { href: "/app/responder", label: "Conversas", icon: MessageSquareText, shared: true },
    { href: "/app/pacientes", label: "Pacientes", icon: UserRound, shared: true },
    { href: "/app/fila", label: "Minha fila", icon: ListTodo, shared: true },
    { href: "/app/encaminhamentos", label: "Encaminhamentos", icon: Stethoscope, shared: true },
  ],
  medical: [
    { href: "/app/medico", label: "Hoje", icon: LayoutDashboard, shared: false },
    { href: "/app/encaminhamentos", label: "Pendências", icon: Stethoscope, shared: true },
    { href: "/app/documentos", label: "Documentos", icon: FileLock2, shared: true },
  ],
  management: [
    { href: "/app/gestao", label: "Visão geral", icon: LayoutDashboard, shared: false },
    { href: "/app/fila", label: "Operação", icon: ListTodo, shared: true },
    { href: "/app/equipe", label: "Equipe", icon: Users, shared: false },
    { href: "/app/configuracoes", label: "Configurações", icon: Settings, shared: false },
  ],
} satisfies Record<WorkspaceKind, Array<{ href: string; label: string; icon: typeof LayoutDashboard; shared: boolean }>>;

export function AppShell({
  membership,
  profile,
  email,
  children,
}: {
  membership: WorkspaceMembership;
  profile: Profile | null;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isManagement = membership.role === "owner" || membership.role === "manager";

  const availableWorkspaces: WorkspaceKind[] = [];
  if (membership.operational_role !== "doctor") availableWorkspaces.push("attendance");
  if (membership.operational_role === "doctor") availableWorkspaces.push("medical");
  if (isManagement) availableWorkspaces.push("management");
  if (availableWorkspaces.length === 0) availableWorkspaces.push("attendance");

  const requestedWorkspace = searchParams.get("workspace") as WorkspaceKind | null;
  let activeWorkspace: WorkspaceKind = availableWorkspaces[0];
  if (pathname.startsWith("/app/medico")) activeWorkspace = "medical";
  else if (pathname.startsWith("/app/gestao") || pathname.startsWith("/app/equipe") || pathname.startsWith("/app/perfil-comercial") || pathname.startsWith("/app/configuracoes")) activeWorkspace = "management";
  else if (pathname.startsWith("/app/atendimento")) activeWorkspace = "attendance";
  else if (requestedWorkspace && availableWorkspaces.includes(requestedWorkspace)) activeWorkspace = requestedWorkspace;

  if (!availableWorkspaces.includes(activeWorkspace)) activeWorkspace = availableWorkspaces[0];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function changeWorkspace(workspace: WorkspaceKind) {
    router.push(WORKSPACE_HOME[workspace]);
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Logo />
        <div className="clinic-switcher clinic-switcher-compact">
          <small>Clínica</small>
          <strong>{membership.clinic.name}</strong>
          {availableWorkspaces.length > 1 ? (
            <label className="workspace-select-label">
              <span>Ambiente</span>
              <select
                aria-label="Trocar ambiente"
                className="select workspace-select"
                value={activeWorkspace}
                onChange={(event) => changeWorkspace(event.target.value as WorkspaceKind)}
              >
                {availableWorkspaces.map((workspace) => (
                  <option key={workspace} value={workspace}>{WORKSPACE_LABELS[workspace]}</option>
                ))}
              </select>
            </label>
          ) : (
            <span className="workspace-current">{WORKSPACE_LABELS[activeWorkspace]}</span>
          )}
        </div>
        <nav className="sidebar-nav" aria-label={`Navegação do ambiente ${WORKSPACE_LABELS[activeWorkspace]}`}>
          {navigation[activeWorkspace].map((item) => {
            const active = pathname === item.href || (item.href !== WORKSPACE_HOME[activeWorkspace] && pathname.startsWith(item.href));
            const Icon = item.icon;
            const href = item.shared ? `${item.href}?workspace=${activeWorkspace}` : item.href;
            return (
              <Link key={item.href} className={`nav-item ${active ? "nav-item-active" : ""}`} href={href}>
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
            <strong style={{ fontSize: "0.82rem" }}>{WORKSPACE_LABELS[activeWorkspace]}</strong>
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
