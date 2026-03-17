import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // We instantiate the client using the SERVICE ROLE KEY to bypass RLS and use Admin Auth API
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { email, preferredName } = await req.json();

        if (!email || !preferredName) {
            return new Response(
                JSON.stringify({ error: 'Email and preferred name are required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Securely invite the user via Supabase Auth Admin
        const { data: authData, error: authError } = await supabaseClient.auth.admin.inviteUserByEmail(email);

        if (authError) {
            throw authError;
        }

        return new Response(
            JSON.stringify({ message: 'User invited successfully', data: authData }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
