"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

async function sendPresence(online: boolean) {
  try {
    await api("/v1/presence", { method: "POST", body: { online } });
  } catch {
    // Presence never blocks the rest of the site.
  }
}

export function PresencePing() {
  useEffect(() => {
    let timer = 0;
    function beat() {
      if (document.visibilityState === "visible") void sendPresence(true);
    }
    function onVisibility() {
      void sendPresence(document.visibilityState === "visible");
    }
    function onHide() {
      void sendPresence(false);
    }
    beat();
    timer = window.setInterval(beat, 25000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      void sendPresence(false);
    };
  }, []);
  return null;
}

export async function markOffline() {
  await sendPresence(false);
}
