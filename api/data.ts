import type { IncomingMessage, ServerResponse } from 'http';
import { Octokit } from "octokit";
import { createClient } from '@supabase/supabase-js';

interface VercelRequest extends IncomingMessage {
  headers: any;
  body: any;
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

  // Robust Sanitization
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

const isDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

const verifyAdmin = async (req: VercelRequest) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  
  const token = authHeader.split("Bearer ")[1];
  const client = getSupabase();
  
  if (!client) {
    if (isDev) return { email: "dev@local.com", isMaster: true };
    throw new Error("Sovereign Cloud unreachable");
  }

  // Token verify logic for Supabase
  const { data: { user }, error } = await client.auth.getUser(token);
  
  if (error || !user || !user.email) {
    throw new Error("Unauthorized: " + (error?.message || "User not found"));
  }

  const email = user.email.toLowerCase().trim();
  
  // Master Admins always pass
  if (MASTER_ADMINS.some(m => m.toLowerCase() === email)) return { email, isMaster: true };
  
  // Sovereign Auth Check - Check settings.data.admins
  const { data: supaData } = await client.from('settings').select('data').eq('id', 1).single();
  if (supaData && supaData.data) {
    const admins = supaData.data.admins || [];
    if (admins.map((a: string) => a.toLowerCase().trim()).includes(email)) return { email, isMaster: false };
  }

  throw new Error("Access Denied");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'hadyfinianos-sudo';
  const repo = process.env.GITHUB_REPO || 'big_boss';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const path = process.env.GITHUB_REGISTRY_PATH || 'registry.json';
  const octokit = token ? new Octokit({ auth: token }) : null;

  if (req.method === 'GET') {
    try {
      const client = getSupabase();
      // 1. Sovereign Cloud Fetch (Supabase Only)
      if (client) {
        console.log("[Sovereign API] Direct Cloud Access: Fetching 'settings'...");
        const { data, error } = await client.from('settings').select('data').eq('id', 1).single();
        
        if (!error && data && data.data) {
          return res.status(200).json(data.data);
        }
        
        if (error && !isDev) {
          console.error("[Sovereign API] Supabase fetch failed:", error.message);
          return res.status(502).json({ error: "Sovereign Cloud unreachable: " + error.message });
        }
      }
      
      // 2. Dev/Local Fallback to GitHub or Local
      if (isDev && octokit) {
        try {
          const { data: fileData }: any = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
          return res.status(200).json(JSON.parse(Buffer.from(fileData.content, 'base64').toString()));
        } catch (e) {
          console.warn("[Dev Fallback] GitHub Fetch failed, empty registry.");
        }
      }
      
      if (isDev) {
        return res.status(200).json({ siteConfig: { siteTitle: 'Dev Local' }, categories: [], articles: [], admins: MASTER_ADMINS });
      }

      console.error("[Sovereign API] No Cloud Connection Established.");
      return res.status(503).json({ error: "Site Sovereignty compromised: No Cloud Connection." });
    } catch (error: any) {
      console.error("[Sovereign API] Fatal Retrieval Error:", error.message);
      return res.status(500).json({ error: "Critical Sovereign Failure." });
    }
  }

  if (req.method === 'POST') {
    try {
      const { email, isMaster } = await verifyAdmin(req);
      const { _logAction, _logTarget, ...body } = req.body;
      
      const client = getSupabase();
      
      if (!client && !isDev && !isMaster) {
        throw new Error("Sovereign connection missing during save operation.");
      }

      // 1. Save to Supabase Settings (Primary)
      if (client) {
        console.log("[Sovereign API] Updating Cloud (Settings Table)...");
        const { error: saveError } = await client.from('settings').upsert({ id: 1, data: body });
        
        if (saveError) {
          console.error("[Sovereign API] Cloud Save failed:", saveError.message);
          if (!isDev) throw new Error("Sovereign Cloud Save Failed: " + saveError.message);
        }
          
        // 2. Log Action in Cloud
        if (_logAction) {
          await client.from('logs').insert({
            id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            admin_email: email,
            action_type: _logAction,
            details: { update: true, timestamp: new Date().toISOString() },
            target_id: _logTarget || 'N/A',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 3. GitHub Multi-Sync (Backup)
      if (octokit) {
         try {
           console.log("[Sovereign API] Syncing to GitHub Backup...");
           const { data: existing }: any = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
           await octokit.rest.repos.createOrUpdateFileContents({
             owner, repo, path, branch, sha: existing.sha,
             message: `Sovereign Sync: ${email}`,
             content: Buffer.from(JSON.stringify(body, null, 2)).toString('base64'),
           });
         } catch (e) {
           console.warn("[Sovereign API] GitHub Sync failed.");
         }
      }

      return res.status(200).json({ status: 'Sovereignty Maintained', timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error("[Sovereign API] Save Exception:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
