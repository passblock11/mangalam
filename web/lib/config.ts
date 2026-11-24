export const publicConfig = {
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://behlrsqilhzhniglhgqh.supabase.co",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_G8YGou0J7alwZirbjuCQdQ_YCiyk0LD",
  apiBase:
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://mangalam-api.vercel.app",
};

export const supportEmail = "passblock.securities@gmail.com";
/** Merchant legal name shown on the public site footer (payment gateway verification). */
export const merchantLegalName = "Tejas Vasant Borate";
export const merchantContactEmail = supportEmail;
export const siteName = "Mangalam";
