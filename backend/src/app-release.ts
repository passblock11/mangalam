import { getSupabaseAdmin } from "./supabase.js";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.mangalam.matrimony";

const DEFAULT_TITLE = "Update Mangalam";
const DEFAULT_MESSAGE = "A new version of Mangalam is required to continue.";

export type AppRelease = {
  force_update: boolean;
  android_min_version_code: number;
  android_latest_version_name: string;
  title: string;
  message: string;
  play_store_url: string;
};

export function playStoreUrlOk(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "play.google.com" &&
      url.pathname === "/store/apps/details" &&
      url.searchParams.get("id") === "com.mangalam.matrimony"
    );
  } catch {
    return false;
  }
}

function releasedOff(): AppRelease {
  return {
    force_update: false,
    android_min_version_code: 0,
    android_latest_version_name: "",
    title: DEFAULT_TITLE,
    message: DEFAULT_MESSAGE,
    play_store_url: PLAY_STORE_URL,
  };
}

/** Public read. Any database or column problem leaves the app open. */
export async function readAppRelease(): Promise<AppRelease> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("app_settings")
      .select(
        "force_update_enabled,android_min_version_code,android_latest_version_name,force_update_title,force_update_message,play_store_url"
      )
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return releasedOff();
    const min = Number(data.android_min_version_code);
    const versionCode = Number.isInteger(min) ? min : 0;
    const versionName = String(data.android_latest_version_name ?? "").trim().slice(0, 32);
    const title = String(data.force_update_title ?? "").trim().slice(0, 80) || DEFAULT_TITLE;
    const message = String(data.force_update_message ?? "").trim().slice(0, 400) || DEFAULT_MESSAGE;
    const storeUrl = String(data.play_store_url ?? "").trim();
    const url = playStoreUrlOk(storeUrl) ? storeUrl : PLAY_STORE_URL;
    const ready =
      data.force_update_enabled === true &&
      versionCode >= 1 &&
      title.length >= 3 &&
      message.length >= 10 &&
      playStoreUrlOk(url);
    return {
      force_update: ready,
      android_min_version_code: versionCode,
      android_latest_version_name: versionName,
      title,
      message,
      play_store_url: url,
    };
  } catch {
    return releasedOff();
  }
}
