// Soft Archive direction: archive rail + offset canvas, Rose Archive accent, tactile pastel surfaces, short easing.
import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Archive, Bell, FileText, Home, Menu, Plus, Settings2, ShieldCheck, Sparkles, X, Wrench } from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "@/_core/hooks/useAuth";

const primaryNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/stash", label: "My Stash", icon: Archive },
  { href: "/risk-radar", label: "Risk Radar", icon: ShieldCheck },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/ask-stashly", label: "Ask StashVault", icon: Sparkles },
  { href: "/before-you-buy", label: "Before You Buy", icon: Bell },
  { href: "/repair", label: "Repair & Sustainability", icon: Wrench },
];

function NavItem({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: typeof Home; onNavigate?: () => void }) {
  const [location] = useLocation();
  const active = href === "/dashboard" ? location === "/" || location === "/dashboard" : location.startsWith(href);
  return <Link href={href} onClick={onNavigate} className={`nav-item ${active ? "nav-item--active" : ""}`}><Icon size={17} strokeWidth={active ? 2 : 1.7} /><span>{label}</span></Link>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const name = user?.displayName?.trim() || user?.name?.trim() || "Your archive";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "S";
  return <div className="app-shell"><aside className={`archive-sidebar ${menuOpen ? "archive-sidebar--open" : ""}`}><div className="sidebar-topline"><Brand /><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={18} /></button></div><div className="sidebar-section-label">Your archive</div><nav className="sidebar-nav" aria-label="Primary navigation">{primaryNav.map((item) => <NavItem key={item.href} {...item} onNavigate={() => setMenuOpen(false)} />)}</nav><div className="sidebar-rule" /><NavItem href="/settings" label="Settings" icon={Settings2} onNavigate={() => setMenuOpen(false)} /><div className="sidebar-footer"><div className="sidebar-note"><span className="sidebar-note__spark"><Sparkles size={14} /></span><div><strong>Your details, in one place.</strong><span>StashVault is being shaped around your real life.</span></div></div><button className="profile-chip profile-chip--button" onClick={() => logout()} title="Sign out of StashVault"><span className="avatar">{initials}</span><span><strong>{name}</strong><small>Personal archive · Sign out</small></span><span className="profile-chip__dot" /></button></div></aside>{menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation overlay" />}<main className="app-main"><header className="mobile-header"><button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><Brand compact /><Link href="/settings" className="icon-button" aria-label="Open settings"><Settings2 size={18} /></Link></header><div className="app-content">{children}</div><nav className="mobile-nav" aria-label="Mobile navigation"><NavItem href="/dashboard" label="Home" icon={Home} /><NavItem href="/stash" label="Stash" icon={Archive} /><Link href="/add" className="mobile-add" aria-label="Add to stash"><Plus size={23} /></Link><NavItem href="/risk-radar" label="Alerts" icon={Bell} /><NavItem href="/settings" label="Profile" icon={Settings2} /></nav></main></div>;
}
