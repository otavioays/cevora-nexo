export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "gold";
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}
