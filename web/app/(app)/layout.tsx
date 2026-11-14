"use client";

import { MemberShell } from "@/components/member-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
