import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Cevora Nexo">
      <span className="brand-mark" aria-hidden="true">
        N
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>CEVORA</strong>
          <small>NEXO</small>
        </span>
      )}
    </Link>
  );
}
