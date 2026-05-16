export default function handler(req, res) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    diagnostics: {
      has_supabase_url: !!SUPABASE_URL,
      has_supabase_key: !!SUPABASE_KEY,
      node_env: process.env.NODE_ENV,
      port: process.env.PORT
    }
  });
}
