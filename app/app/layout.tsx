import { AppShell } from "@/components/dashboard/app-shell";
import { requireMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, activeMembership } = await requireMembership();

  return (
    <AppShell membership={activeMembership} profile={profile} email={user.email ?? profile?.email ?? ""}>
      {children}
    </AppShell>
  );
}
