import { notFound } from "next/navigation";
import { InvitationCard } from "@/components/invite/invitation-card";
import { getCurrentUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { InvitationPreview } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasSupabaseEnv()) notFound();

  const supabase = await createClient();
  const [{ data, error }, context] = await Promise.all([
    supabase.rpc("get_clinic_invitation_preview", { p_token: token }),
    getCurrentUserContext(),
  ]);

  if (error || !data || (Array.isArray(data) && data.length === 0)) notFound();
  const preview = (Array.isArray(data) ? data[0] : data) as InvitationPreview;

  return (
    <main className="centered-page">
      <InvitationCard
        token={token}
        preview={preview}
        authenticated={Boolean(context.user)}
        currentEmail={context.user?.email ?? null}
      />
    </main>
  );
}
