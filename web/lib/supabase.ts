import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "./config";

export const supabase = createClient(publicConfig.supabaseUrl, publicConfig.supabaseKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
