import type { IncomingMessage, ServerResponse } from 'http';
import { Octokit } from "octokit";
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

// Sovereign Master List
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

const isDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

const verifyAdmin = async (req: VercelRequest) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  
  const token = authHeader.split("Bearer ")[1];
  const supabase = getSupabase();

  if (!supabase) {
    if (isDev) return { email: "dev@local.com", isMaster: true };
    throw new Error("Sovereign Cloud unreachable");
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || !user.email) {
    throw new Error("Unauthorized: " + (error?.message || "User not found"));
  }

  const email = user.email.toLowerCase().trim();

  if (MASTER_ADMINS.some(m => m.toLowerCase() === email)) return { email, isMaster: true };
  
  // 1. Try Supabase Sovereign Settings First
  try {
    const { data: supaData } = await supabase.from('settings').select('data').eq('id', 1).single();
    if (supaData && supaData.data) {
      const admins = supaData.data.admins || [];
      if (admins.map((a: string) => a.toLowerCase().trim()).includes(email)) return { email, isMaster: false };
    }
  } catch (e) {
    console.error("[Sovereign Auth] Supabase check failed", e);
  }

  // 2. Fallback to GitHub Registry
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) {
    const octokit = new Octokit({ auth: ghToken });
    try {
      const owner = process.env.GITHUB_OWNER || 'hadyfinianos-sudo';
      const repo = process.env.GITHUB_REPO || 'big_boss';
      const dataPath = process.env.GITHUB_REGISTRY_PATH || 'registry.json';
      const branch = process.env.GITHUB_BRANCH || 'main';
      const { data: fileData }: any = await octokit.rest.repos.getContent({
        owner, repo, path: dataPath, ref: branch
      });
      const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      if ((content.admins || []).map((a: string) => a.toLowerCase().trim()).includes(email)) return { email, isMaster: false };
    } catch (e) {}
  }

  throw new Error("Access Denied");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = await verifyAdmin(req);
    const { url }: { url: string } = req.body;
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) throw new Error('GITHUB_TOKEN Missing');
    if (!url) throw new Error('URL string is missing');

    const octokit = new Octokit({ auth: token });
    const owner = process.env.GITHUB_OWNER || 'hadyfinianos-sudo';
    const repo = process.env.GITHUB_REPO || 'big_boss';
    const branch = process.env.GITHUB_BRANCH || 'main';

    let path = '';
    // Format expected: https://raw.githubusercontent.com/owner/repo/branch/public/archive/filename.ext
    const marker = `${owner}/${repo}/${branch}/`;
    const markerIdx = url.indexOf(marker);
    if (markerIdx === -1) {
       // Not our string. Skip delete.
       return res.status(200).json({ success: true, message: 'Not a recognized github url' });
    }
    path = url.substring(markerIdx + marker.length);

    let sha: string | undefined;
    try {
      const { data: existingFile }: any = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });
      sha = existingFile.sha;
    } catch (e) {
       // File doesn't exist, we consider delete successful
       return res.status(200).json({ success: true, message: 'File not found' });
    }

    if (sha) {
       await octokit.rest.repos.deleteFile({
         owner, repo, path, branch,
         sha,
         message: `Deleted by Admin: ${email}`,
       });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(error.message === 'Access Denied' ? 403 : 500).json({ error: error.message });
  }
}
