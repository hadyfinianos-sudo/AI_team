import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface VercelRequest extends IncomingMessage {
  headers: any;
  body: any;
  method?: string;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

const MASTER_ADMINS = ["hady.finianos@gmail.com", "hadyfinianos@gmail.com"];

const getSupabase = () => {
    const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!rawUrl || !key) return null;
    const url = rawUrl.split('/rest/v1')[0].split('/auth/v1')[0].replace(/\/$/, "");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { 'apikey': key } } });
};

const isDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

const verifyAdmin = async (req: VercelRequest) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.split("Bearer ")[1];
  const supabase = getSupabase();
  if (!supabase) {
    if (isDev) return { email: "dev@local.com" };
    throw new Error("Sovereign Cloud unreachable");
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || !user.email) throw new Error("Unauthorized: " + (error?.message || "User not found"));
  const email = user.email.toLowerCase().trim();
  if (MASTER_ADMINS.some(m => m.toLowerCase() === email)) return { email };
  try {
    const { data: supaData } = await supabase.from('settings').select('data').eq('id', 1).single();
    if (supaData && supaData.data) {
      const admins = supaData.data.admins || [];
      if (admins.map((a: string) => a.toLowerCase().trim()).includes(email)) return { email };
    }
  } catch (e) {
    console.error("[Sovereign Auth] Cloud Access Error:", e);
  }
  throw new Error("Access Denied");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await verifyAdmin(req);
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) throw new Error(`Failed to fetch external resource: ${fetchResponse.statusText}`);

    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = fetchResponse.headers.get('content-type') || 'application/octet-stream';

    return res.status(200).json({ 
      success: true, 
      fileContent: base64, 
      contentType,
      fileName: url.split('/').pop()?.split('?')[0] || 'downloaded_file'
    });
  } catch (error: any) {
    console.error("[Sovereign API] Proxy Fetch Failed:", error.message);
    return res.status(error.message.includes('Access Denied') ? 403 : 500).json({ error: error.message });
  }
}
