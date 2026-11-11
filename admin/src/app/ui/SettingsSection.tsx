"use client";

import { useEffect, useState } from "react";
import { Settings, CreditCard, Tag, FileText, UserCog, Sliders } from "lucide-react";
import { GeneralSettings } from "./settings/GeneralSettings";
import { PaymentSettings } from "./settings/PaymentSettings";
import { PlansSettings } from "./settings/PlansSettings";
import { CouponsSettings } from "./settings/CouponsSettings";
import { LegalSettings } from "./settings/LegalSettings";
import { AdminsSettings } from "./settings/AdminsSettings";

type Sub = "general" | "payment" | "plans" | "coupons" | "legal" | "admins";

const TABS: { id: Sub; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "general", label: "General", icon: Sliders },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "plans", label: "Plans", icon: Tag },
  { id: "coupons", label: "Coupons", icon: Tag },
  { id: "legal", label: "Legal pages", icon: FileText },
  { id: "admins", label: "Admins", icon: UserCog },
];

export function SettingsSection() {
  const [sub, setSub] = useState<Sub>("general");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--ink)]">
          <Settings size={20} className="text-[var(--maroon)]" /> Settings
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Configure payments, plans, coupons, legal content & admins.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border)] bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              sub === t.id
                ? "bg-[var(--maroon)] text-white"
                : "text-[var(--muted)] hover:bg-zinc-100 hover:text-[var(--ink)]"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {sub === "general" && <GeneralSettings />}
      {sub === "payment" && <PaymentSettings />}
      {sub === "plans" && <PlansSettings />}
      {sub === "coupons" && <CouponsSettings />}
      {sub === "legal" && <LegalSettings />}
      {sub === "admins" && <AdminsSettings />}
    </div>
  );
}
