import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface VercelRequest extends IncomingMessage {
  headers: any;
  method?: string;
  query?: any;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

const MASTER_ADMINS = ["hady.finianos@gmail.com", "hadyfinianos@gmail.com"];

const getSupabase = () => {
    const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!rawUrl || !key) {
      console.error("[Sovereign] ERROR: Missing Supabase URL or Key in process.env");
      return null;
    }

    const url = rawUrl.split('/rest/v1')[0].split('/auth/v1')[0].replace(/\/$/, "");

    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'apikey': key
        }
      }
    });
};

const verifyAdmin = async (req: VercelRequest) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  
  const token = authHeader.split("Bearer ")[1];
  const supabase = getSupabase();
  if (!supabase) throw new Error("Sovereign Cloud unreachable");

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || !user.email) throw new Error("Unauthorized");
  
  const email = user.email.toLowerCase().trim();
  if (MASTER_ADMINS.some(m => m.toLowerCase() === email)) return email;
  
  throw new Error("Unauthorized");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const id = url.searchParams.get('id');

  if (req.method === 'DELETE') {
    try {
      await verifyAdmin(req);
      if (!id) return res.status(400).json({ error: "Log ID is required" });

      if (supabase) {
        const { error } = await supabase.from('logs').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
      throw new Error("Sovereign Cloud unreachable");
    } catch (error: any) {
      console.error("[Sovereign Logs Delete Error]", error);
      return res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
    }
  }

  if (req.method === 'GET') {
    try {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized', logs: [] });
      await verifyAdmin(req);
      
      // Sovereign Cloud Retrieval
      if (supabase) {
        try {
          console.log("[Sovereign Logs] Direct Fetch from Cloud...");
          const { data, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(200);
          
          if (error) {
            console.error("[Sovereign Logs Error]", error.message);
            return res.status(502).json({ error: "Cloud log retrieval failed: " + error.message, logs: [] });
          }

          if (data) {
            // Normalize to UI expected format
            const formattedLogs = data.map((l: any) => ({
              id: l.id,
              adminEmail: l.admin_email,
              actionType: l.action_type,
              details: typeof l.details === 'string' ? l.details : JSON.stringify(l.details),
              targetId: l.target_id,
              timestamp: l.timestamp
            }));
            return res.status(200).json({ logs: formattedLogs });
          }
        } catch (supaErr) {
          console.error("[Sovereign Logs Exception]", supaErr);
        }
      }

      console.error("[Sovereign Logs] Cloud connection is missing.");
      return res.status(503).json({ error: "Sovereign logs connection unavailable.", logs: [] });
    } catch (error: any) {
      console.error("[Sovereign Logs Handler Error]", error);
      return res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
        error: error.message,
        logs: [] 
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
