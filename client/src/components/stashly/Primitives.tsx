// Soft Archive direction: tactile archive tabs, warm cream surfaces, editorial asymmetry, and restrained interactions.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Camera, CheckCircle2, ChevronRight, CircleAlert, FileText, Headphones, Laptop, Package, Smartphone, Sparkles } from "lucide-react";

export type ProductKind = "phone" | "laptop" | "headphones" | "camera" | "package";
const productIcons = { phone: Smartphone, laptop: Laptop, headphones: Headphones, camera: Camera, package: Package };

export function IconBadge({ kind, tone = "blush" }: { kind: ProductKind; tone?: "blush" | "sage" | "lavender" | "sand" }) {
  const Icon = productIcons[kind];
  return <span className={`icon-badge icon-badge--${tone}`} aria-hidden="true"><Icon size={20} strokeWidth={1.7} /></span>;
}

export function StatusBadge({ status, children }: { status: "safe" | "watch" | "expired" | "neutral"; children: ReactNode }) {
  return <span className={`status-badge status-badge--${status}`}>{children}</span>;
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>;
}

export function ProductCard({ kind, tone, name, detail, status, statusText, secondaryStatus, secondaryStatusText, href = "/product/1" }: { kind: ProductKind; tone: "blush" | "sage" | "lavender" | "sand"; name: string; detail: string; status: "safe" | "watch" | "expired" | "neutral"; statusText: string; secondaryStatus?: "safe" | "watch" | "expired" | "neutral"; secondaryStatusText?: string; href?: string }) {
  return <Link href={href} className="product-card"><div className="product-card__top"><IconBadge kind={kind} tone={tone} /><ArrowUpRight size={16} className="product-card__arrow" /></div><div className="product-card__copy"><strong>{name}</strong><span>{detail}</span></div><div className="product-card__receipt-slip"><span>SAVED RECORD</span><span>···</span></div><div className="product-card__badges"><StatusBadge status={status}>{statusText}</StatusBadge>{secondaryStatus && secondaryStatusText && <StatusBadge status={secondaryStatus}>{secondaryStatusText}</StatusBadge>}</div></Link>;
}

export function EmptyState({ title, copy, cta = "Add your first item", href = "/add" }: { title: string; copy: string; cta?: string; href?: string }) {
  return <div className="empty-state"><img src="/manus-storage/stashly-empty-state_9d71857b.jpg" alt="A small archival box with a blush ribbon" /><div className="empty-state__copy"><span className="eyebrow">A fresh page</span><h3>{title}</h3><p>{copy}</p><Link href={href} className="button button--primary button--small">{cta}<ArrowUpRight size={15} /></Link></div></div>;
}

export function PlaceholderPage({ eyebrow, title, description, kind = "archive", cta }: { eyebrow: string; title: string; description: string; kind?: "archive" | "documents" | "spark" | "repair" | "settings"; cta?: { label: string; href: string } }) {
  const Icon = kind === "documents" ? FileText : kind === "spark" ? Sparkles : kind === "repair" ? CircleAlert : kind === "settings" ? Package : CheckCircle2;
  return <div className={`placeholder-page placeholder-page--${kind}`}><div className="placeholder-page__copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><div className="placeholder-page__actions">{cta ? <Link className="button button--primary" href={cta.href}>{cta.label}<ArrowUpRight size={16} /></Link> : <span className="coming-soon"><span className="coming-soon__dot" />Phase 2 feature shell</span>}</div></div><div className="placeholder-page__art"><div className="placeholder-orbit placeholder-orbit--one" /><div className="placeholder-orbit placeholder-orbit--two" /><div className="placeholder-art-card"><Icon size={38} strokeWidth={1.25} /><span>Made for the details worth keeping.</span></div></div></div>;
}

export function MiniMetric({ label, value, note, tone }: { label: string; value: string; note: string; tone: "blush" | "sage" | "lavender" }) {
  return <div className={`mini-metric mini-metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export function ChevronLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="chevron-link">{children}<ChevronRight size={15} /></Link>;
}
