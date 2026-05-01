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
  
  // 1. Try Supabase Sovereign Settings First (Primary Auth)
  try {
    const { data: supaData } = await supabase.from('settings').select('data').eq('id', 1).single();
    if (supaData && supaData.data) {
      const admins = supaData.data.admins || [];
      if (admins.map((a: string) => a.toLowerCase().trim()).includes(email)) return { email, isMaster: false };
    }
  } catch (e) {
    console.error("[Sovereign Auth] Cloud Access Error:", e);
  }

  // 2. Emergency Backup Check (GitHub Only if Cloud fails but token exists)
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) {
    const octokit = new Octokit({ auth: ghToken });
    try {
      const owner = process.env.GITHUB_OWNER || 'hadyfinianos-sudo';
      const repo = process.env.GITHUB_REPO || 'big_boss';
      const dataPath = process.env.GITHUB_REGISTRY_PATH || 'registry.json';
      const branch = process.env.GITHUB_BRANCH || 'main';
      const { data: fileData }: any = await octokit.rest.repos.getContent({ owner, repo, path: dataPath, ref: branch });
      const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      if ((content.admins || []).map((a: string) => a.toLowerCase().trim()).includes(email)) return { email, isMaster: false };
    } catch (e) {}
  }

  throw new Error("Access Denied");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabase();

  try {
    const { email } = await verifyAdmin(req);
    const { fileName, fileData }: { fileName: string; fileData: string } = req.body;
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'hadyfinianos-sudo';
    const repo = process.env.GITHUB_REPO || 'big_boss';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const pdfPath = process.env.GITHUB_ARCHIVE_PATH || 'public/data';
    const path = `${pdfPath}/${fileName}`;

    if (!token) throw new Error('GITHUB_TOKEN Missing');
    const octokit = new Octokit({ auth: token });

    const logActivity = async (actionType: string, details: any, targetId?: string) => {
      try {
        if (supabase) {
          await supabase.from('logs').insert({
            id: 'log-' + Date.now(),
            admin_email: email,
            action_type: actionType,
            details: details,
            target_id: targetId || "N/A",
            timestamp: new Date().toISOString()
          });
        }
        
        const logsPath = 'logs.json';
        let logs = [];
        let sha: string | undefined;
        try {
          const { data: fileData }: any = await octokit.rest.repos.getContent({
            owner, repo, path: logsPath, ref: branch
          });
          sha = fileData.sha;
          logs = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
        } catch (e) {}

        logs.unshift({
          id: 'log-' + Date.now(),
          adminEmail: email,
          actionType,
          details: JSON.stringify(details),
          targetId: targetId || "N/A",
          timestamp: new Date().toISOString()
        });

        if (logs.length > 200) logs = logs.slice(0, 200);

        await octokit.rest.repos.createOrUpdateFileContents({
          owner, repo, path: logsPath, branch, sha,
          message: `Activity Log: ${actionType} by ${email}`,
          content: Buffer.from(JSON.stringify(logs, null, 2)).toString('base64'),
        });
      } catch (e) {
        console.error("Failed to log activity:", e);
      }
    };

    // Get SHA if file exists to avoid "sha wasn't supplied" error
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
      // File doesn't exist, proceed with new file
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner, repo, path, branch,
      sha,
      message: `Upload by Admin: ${email}`,
      content: fileData.split(',')[1] || fileData,
    });

    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    
    // Log the upload action
    await logActivity("ADD_FILE", { fileName, url }, `تم إضافة ملف جديد: ${fileName}`);

    return res.status(200).json({ success: true, url: url });
  } catch (error: any) {
    return res.status(error.message === 'Access Denied' ? 403 : 500).json({ error: error.message });
  }
}

// Deployment Test - 2026-04-27
