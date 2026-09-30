"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { useCountry } from "@/components/country-provider";
import type { MediaType } from "@/lib/media";

export function TitleViewTracker({ mediaType, titleId }: { mediaType: MediaType; titleId: number }) {
  const { session, loading: authLoading } = useAuth();
  const { country, loading, refreshing } = useCountry();
  const token = session?.access_token;
  const userId = session?.user.id;
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    const identity = `${country.code}:${mediaType}:${titleId}:${userId ?? "anonymous"}`;
    if (loading || authLoading || refreshing || navigator.doNotTrack === "1"
      || recorded.current === identity
      || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    async function record() {
      if (started || document.visibilityState !== "visible") return;
      started = true;
      try {
        const send = () => fetch("/api/title-view", {
          method: "POST", credentials: "same-origin", signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ mediaType, titleId }),
        });
        let response = await send();
        // Establish a signed first-party cookie before accepting the first view.
        if (response.status === 202 && (await response.json()).reason === "initialized" && !controller.signal.aborted) response = await send();
        if (response.ok && !controller.signal.aborted) recorded.current = identity;
      } catch { /* Analytics never interrupts details, availability, or wishlist. */ }
    }
    function visible() {
      clearTimeout(timer);
      if (document.visibilityState === "visible" && !started) timer = setTimeout(() => void record(), 1500);
    }
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [mediaType, titleId, country.code, loading, authLoading, refreshing, token, userId]);
  return null;
}
