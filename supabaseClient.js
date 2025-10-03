// supabaseClient.js
// Lightweight CommonJS helper for server-side Supabase usage.
// WARNING: Do NOT commit your real service role key. Put real values into `.env` or your host's secret store.

const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.warn('[supabaseClient] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Returning null client.');
        return null;
    }

    // Create a server-side client using the service role key. Keep this key secret.
    const supabase = createClient(url, key, {
        auth: {
            persistSession: false,
        },
    });

    return supabase;
}

module.exports = { getSupabaseClient };
