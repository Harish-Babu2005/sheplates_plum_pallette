"use client";
// Shell for the vendor, operations and super admin portals, built from the approved boards (V/O/A website, MV/MO/MA phone):
// a white sidebar with an orange active pill on a light-grey page on the website, and on phones a top bar,
// a four-tab bottom bar plus "More", and a full-screen menu.
import type { ComponentType, ReactNode } from "react";
import { Bell, HelpCircle, LogOut, Menu, X, LayoutDashboard } from "@/components/icons";

type Icon = ComponentType<{ className?: string }>;

/** The four bottom tabs per role (page names as the nav uses them); everything else sits under More. */
const PHONE_TABS: Record<string, string[]> = {
  vendor: ["Dashboard", "Orders", "Catalog", "Food Drops"],
  operations: ["Command centre", "Orders", "Vendor onboarding", "Ticket centre"],
  admin: ["Executive view", "Users", "Vendors", "Vendor plans"],
};
const TAB_LABEL: Record<string, string> = { Dashboard: "Home", "Command centre": "Home", "Executive view": "Home", "Vendor onboarding": "Vendors", "Ticket centre": "Tickets", "Vendor plans": "Plans", Catalog: "Catalogue" };

export function StaffShell({ role, roleLabel, items, icons, active, onNavigate, unread, name, email, menuOpen, onMenu, onNotifications, onSignOut, onReplayTour, banner, counts, children }: {
  role: string; roleLabel: string; items: string[]; icons: Record<string, Icon>; active: string; onNavigate: (label: string) => void; unread: number;
  name: string; email: string; menuOpen: boolean; onMenu: (open: boolean) => void; onNotifications: () => void; onSignOut: () => void; onReplayTour?: () => void; banner?: ReactNode; counts?: Record<string, number>; children: ReactNode;
}) {
  const tabs = (PHONE_TABS[role] ?? []).filter((t) => items.includes(t));
  const go = (label: string) => { onNavigate(label); onMenu(false); };
  const navButtons = items.map((label) => {
    const Icon = icons[label] ?? LayoutDashboard;
    return <button key={label} type="button" data-tour-nav={label} aria-current={active === label ? "page" : undefined} onClick={() => go(label)} className={`k-nv${active === label ? " on" : ""}`}><Icon className="size-[22px] shrink-0" />{label}{counts?.[label] ? <span className="cnt" style={{ marginLeft: "auto" }}>{counts[label]}</span> : null}</button>;
  });
  return <div className={`sh k-app${menuOpen ? " menu-open" : ""}`}>
    <header className="k-mtop">
      <button type="button" className="ibtn w k-ring" onClick={() => onMenu(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      <img src="/sheplates-logo.png" alt="" className="k-mlogo" />
      <div className="k-mttl">ShePlates</div>
      <span className="k-role k-role-m" data-label={roleLabel} aria-hidden="true" />
      <button type="button" className="ibtn w k-ring" onClick={onNotifications} aria-label="Notifications" style={{ position: "relative" }}><Bell className="size-5" />{unread > 0 && <span className="cnt k-cnt">{unread}</span>}</button>
    </header>
    {menuOpen && <button type="button" className="k-scrim" onClick={() => onMenu(false)} aria-label="Close navigation" />}
    <aside className="k-side">
      <div className="k-brand"><img src="/sheplates-logo.png" alt="" /><div><b>ShePlates</b><span>{roleLabel}</span></div></div>
      <nav aria-label="Portal" className="k-navlist">{navButtons}
        {onReplayTour && <button type="button" className="k-nv" onClick={() => { onReplayTour(); onMenu(false); }}><HelpCircle className="size-[22px] shrink-0" />Help · Product tour</button>}
      </nav>
      <div className="k-who"><div className="av o">{name.slice(0, 1).toUpperCase()}</div><div className="k-who-t"><b>{name}</b><span>{email}</span></div>
        <button type="button" className="ibtn sm" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut className="size-5" /></button></div>
    </aside>
    <main className="k-main sp-portal-main">
      <div className="k-util"><span className="k-role">{roleLabel}</span>
        <button type="button" className="ibtn w k-ring" onClick={onNotifications} aria-label="Notifications" style={{ position: "relative" }}><Bell className="size-5" />{unread > 0 && <span className="cnt k-cnt">{unread}</span>}</button>
        <div className="av o" title={email}>{name.slice(0, 1).toUpperCase()}</div></div>
      {banner}
      {children}
    </main>
    <nav aria-label="Quick tabs" className="k-tabs" aria-hidden={menuOpen || undefined}>
      {tabs.map((t) => { const Icon = icons[t] ?? LayoutDashboard; return <button key={t} type="button" onClick={() => go(t)} className={active === t ? "on" : ""}><span className="pl"><Icon className="size-7" /></span>{TAB_LABEL[t] ?? t}</button>; })}
      <button type="button" onClick={() => onMenu(true)} className={!tabs.includes(active) ? "on" : ""}><span className="pl"><Menu className="size-7" /></span>More</button>
    </nav>
  </div>;
}
