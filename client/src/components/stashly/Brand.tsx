// Soft Archive direction: editorial stationery mood, DM Serif Display + Manrope, Rose Archive accents, quiet motion.
import { Link } from "wouter";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={compact ? "brand brand--compact" : "brand"} aria-label="StashVault home">
      <span className="brand-mark" aria-hidden="true">
        <img src="/manus-storage/stashly-mark_6b22b5b6.png" alt="" />
      </span>
      <span className="brand-copy">
        <span className="brand-name">StashVault</span>
        {!compact && <span className="brand-tagline">Everything you own. Remembered.</span>}
      </span>
    </Link>
  );
}
