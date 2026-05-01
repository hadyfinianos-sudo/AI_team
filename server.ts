// Version 1.0.3 - Pure GitHub Storage Mode
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Octokit } from "octokit";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const GITHUB_CONFIG = {
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER || "hadyfinianos-sudo",
  repo: process.env.GITHUB_REPO || "big_boss",
  branch: process.env.GITHUB_BRANCH || "main",
  dataPath: process.env.GITHUB_REGISTRY_PATH || "registry.json",
  pdfPath: process.env.GITHUB_ARCHIVE_PATH || "public/data"
};

const MASTER_ADMINS = ["hady.finianos@gmail.com", "hadyfinianos@gmail.com"];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add CSP Headers for PDF viewer and workers
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "worker-src 'self' blob:; frame-src 'self' https://drive.google.com https://docs.google.com;"
    );
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  const getOctokit = () => {
    if (!GITHUB_CONFIG.token) {
      console.error("[Sophos Server] CRITICAL: GITHUB_TOKEN is missing in environment variables.");
      throw new Error("Missing GITHUB_TOKEN environment variable. Please configure it in AI Studio Secrets.");
    }
    return new Octokit({ auth: GITHUB_CONFIG.token });
  };

  // Auth Middleware Helper
  const verifyAdmin = async (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing Authorization Header (Bearer Token required)");
    }
    
    const token = authHeader.split("Bearer ")[1];
    const supabase = getSupabase();
    if (!supabase) throw new Error("Sovereign Cloud unreachable");

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user || !user.email) {
      console.error("[Sophos Server] Token Verification Failed:", error?.message);
      throw new Error(`Invalid Supabase Token: ${error?.message || "User not found"}`);
    }

    const email = user.email.toLowerCase().trim();
    
    // 1. Level One: Master Admin Bypass (Hardcoded)
    if (MASTER_ADMINS.some(m => m.toLowerCase() === email)) {
      console.log(`[Sophos Server] Master Admin detected: ${email}`);
      return { email, isMaster: true };
    }

    // 2. Level Two: Check data.json on GitHub for admin list
    try {
      const octokit = getOctokit();
      const { data: fileData }: any = await octokit.rest.repos.getContent({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: GITHUB_CONFIG.dataPath,
        ref: GITHUB_CONFIG.branch
      });
      const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      
      // Support both root admins and a nested path if we change it later
      const adminsList = content.admins || [];
      
      if (Array.isArray(adminsList)) {
        const lowerAdmins = adminsList.map((a: string) => a.toLowerCase().trim());
        if (lowerAdmins.includes(email)) {
          console.log(`[Sophos Server] Dynamic Admin authorized: ${email}`);
          return { email, isMaster: false };
        }
      }
    } catch (e: any) {
      console.warn("[Sophos Server] Dynamic admin lookup failed, falling back to Master only.", e.message);
    }

    throw new Error("Access Denied: You are not authorized to perform this action.");
  };

  // Helper to log activity in GitHub logs.json
  const logActivity = async (email: string, actionType: string, details: any, targetId?: string) => {
    try {
      const octokit = getOctokit();
      const logsPath = 'logs.json';
      
      let logs = [];
      let sha: string | undefined;
      
      try {
        const { data: fileData }: any = await octokit.rest.repos.getContent({
          owner: GITHUB_CONFIG.owner,
          repo: GITHUB_CONFIG.repo,
          path: logsPath,
          ref: GITHUB_CONFIG.branch
        });
        sha = fileData.sha;
        logs = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      } catch (e) {
        // logs.json probably doesn't exist yet
      }

      const newLog = {
        id: 'log-' + Date.now(),
        adminEmail: email,
        actionType,
        details: JSON.stringify(details),
        targetId: targetId || "N/A",
        timestamp: new Date().toISOString()
      };

      logs.unshift(newLog); // Add to beginning
      
      // Keep only last 200 logs
      if (logs.length > 200) {
        logs = logs.slice(0, 200);
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: logsPath,
        branch: GITHUB_CONFIG.branch,
        sha,
        message: `Activity Log: ${actionType} by ${email}`,
        content: Buffer.from(JSON.stringify(logs, null, 2)).toString('base64'),
      });
    } catch (e) {
      console.error("[Sophos Server] Failed to log activity to GitHub:", e);
    }
  };

  // Upload PDF to GitHub
  app.post("/api/upload", async (req, res) => {
    try {
      const { email } = await verifyAdmin(req);
      const { fileName, fileData } = req.body;

      if (!fileName || !fileData) return res.status(400).json({ error: "Missing fileName or fileData" });

      const octokit = getOctokit();
      const filePath = `${GITHUB_CONFIG.pdfPath}/${fileName}`;
      const cleanBase64 = fileData.split(",")[1] || fileData;

      // Get SHA if file exists to avoid "sha wasn't supplied" error
      let sha: string | undefined;
      try {
        const { data: existingFile }: any = await octokit.rest.repos.getContent({
          owner: GITHUB_CONFIG.owner,
          repo: GITHUB_CONFIG.repo,
          path: filePath,
          ref: GITHUB_CONFIG.branch
        });
        sha = existingFile.sha;
      } catch (e) {
        // File doesn't exist, proceed with new file
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: filePath,
        branch: GITHUB_CONFIG.branch,
        sha,
        message: `Upload PDF: ${fileName} by ${email}`,
        content: cleanBase64,
      });

      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${filePath}`;
      
      // Log the upload
      await logActivity(email, "ADD_FILE", { fileName, url: rawUrl }, `تم إضافة ملف جديد: ${fileName}`);

      res.json({ success: true, url: rawUrl, path: filePath });
    } catch (error: any) {
      console.error("Upload failed:", error.message);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // GET App State from GitHub
  app.get("/api/data", async (req, res) => {
    console.log(`[Sophos Server] GET /api/data request received from ${req.ip} - ${new Date().toISOString()}`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      if (!GITHUB_CONFIG.token) {
         console.warn("[Sophos Server] GITHUB_TOKEN is missing. Returning default state.");
         return res.json({
           siteConfig: { siteTitle: 'Big Boss Archive (Local)', siteDescription: 'يرجى تهيئة GITHUB_TOKEN', version: 'v1.0.0-local' },
           categories: [],
           articles: [],
           admins: MASTER_ADMINS
         });
      }

      const octokit = getOctokit();
      const { data: fileData }: any = await octokit.rest.repos.getContent({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: GITHUB_CONFIG.dataPath,
        ref: GITHUB_CONFIG.branch
      });
      const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      console.log(`[Sophos Server] Successfully fetched registry from GitHub for ${req.ip}`);
      res.json(content || {});
    } catch (error: any) {
      console.warn(`[Sophos Server] Registry fetch failed: ${error.message}. Providing fallback JSON.`);
      res.status(200).json({
        siteConfig: { siteTitle: 'Big Boss Archive', siteDescription: 'أرشيف الوثائق الرقمي', version: 'v1.0.0' },
        categories: [],
        articles: [],
        admins: MASTER_ADMINS,
        _error: error.message
      });
    }
  });

  // POST App State to GitHub
  app.post("/api/data", async (req, res) => {
    try {
      const { email } = await verifyAdmin(req);
      const octokit = getOctokit();
      
      const { _logAction, _logTarget, ...body } = req.body;
      
      let sha: string | undefined;
      try {
        const { data: existingFile }: any = await octokit.rest.repos.getContent({
          owner: GITHUB_CONFIG.owner,
          repo: GITHUB_CONFIG.repo,
          path: GITHUB_CONFIG.dataPath,
          ref: GITHUB_CONFIG.branch
        });
        sha = existingFile.sha;
      } catch (e) {
        // File might not exist yet, that's fine
      }

      // Update GitHub
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: GITHUB_CONFIG.dataPath,
        branch: GITHUB_CONFIG.branch,
        sha,
        message: `Update data.json by admin: ${email}`,
        content: Buffer.from(JSON.stringify(body, null, 2)).toString('base64'),
      });

      // SYNC TO SUPABASE (Permanent Storage Redundancy)
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error: supaError } = await supabase
            .from('settings')
            .upsert({ id: 1, data: body });
          if (supaError) console.error("[Sovereign Server] Supabase Sync Warning:", supaError.message);
          else console.log("[Sovereign Server] Cloud Sync Successful.");
        }
      } catch (err) {
        console.error("[Sovereign Server] Supabase Sync Critical Error:", err);
      }

      // Log the action
      if (_logAction) {
        await logActivity(email, _logAction, { update: true }, _logTarget);
      } else {
        await logActivity(email, "GENERAL_UPDATE", { keys: Object.keys(body) });
      }

      res.json({ success: true, version: body.siteConfig?.version });
    } catch (error: any) {
      console.error("Save data failed:", error.message);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // New Endpoint: Get Activity Logs (Sovereign Only)
  app.get("/api/logs", async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const { isMaster } = await verifyAdmin(req);
      if (!isMaster) return res.status(403).json({ error: "Sovereign only" });

      const octokit = getOctokit();
      let logs: any[] = [];
      let sha: string | undefined;

      try {
        const { data: fileData }: any = await octokit.rest.repos.getContent({
          owner: GITHUB_CONFIG.owner,
          repo: GITHUB_CONFIG.repo,
          path: 'logs.json',
          ref: GITHUB_CONFIG.branch
        });
        sha = fileData.sha;
        logs = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      } catch (e) {
        // Return empty logs if file doesn't exist
      }

      // Auto-Cleanup: Delete logs older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const filteredLogs = logs.filter(log => new Date(log.timestamp) >= thirtyDaysAgo);
      
      if (filteredLogs.length !== logs.length) {
        console.log(`[Sophos Server] Cleaning up ${logs.length - filteredLogs.length} old logs...`);
        try {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_CONFIG.owner,
            repo: GITHUB_CONFIG.repo,
            path: 'logs.json',
            branch: GITHUB_CONFIG.branch,
            sha,
            message: `Cleanup old logs`,
            content: Buffer.from(JSON.stringify(filteredLogs, null, 2)).toString('base64'),
          });
        } catch (cleanupError) {
          console.error("Failed to run cleanup task on logs", cleanupError);
        }
      }

      res.json(filteredLogs);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // New Endpoint: Delete Log Entry
  app.delete("/api/logs", async (req, res) => {
    try {
      const { isMaster } = await verifyAdmin(req);
      if (!isMaster) return res.status(403).json({ error: "Sovereign only" });

      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: "Log ID is required" });

      const octokit = getOctokit();
      let logs: any[] = [];
      let sha: string | undefined;

      try {
        const { data: fileData }: any = await octokit.rest.repos.getContent({
          owner: GITHUB_CONFIG.owner,
          repo: GITHUB_CONFIG.repo,
          path: 'logs.json',
          ref: GITHUB_CONFIG.branch
        });
        sha = fileData.sha;
        logs = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
      } catch (e) {
        return res.status(404).json({ error: "Logs file not found" });
      }
      
      const newLogs = logs.filter(log => log.id !== id);
      
      if (newLogs.length === logs.length) {
        return res.json({ success: true, message: "Log not found or already deleted" });
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: 'logs.json',
        branch: GITHUB_CONFIG.branch,
        sha,
        message: `Delete log entry ${id}`,
        content: Buffer.from(JSON.stringify(newLogs, null, 2)).toString('base64'),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Sophos Server] Log deletion failed:", error.message);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // New Endpoint: Proxy Upload to Supabase Storage (bypasses RLS via Service Role)
  app.post("/api/upload-supabase", async (req, res) => {
    try {
      await verifyAdmin(req);
      const { fileName, fileContent, folder, contentType } = req.body;

      if (!fileName || !fileContent) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const supabaseAdmin = getSupabase(); // This uses Service Role if available
      if (!supabaseAdmin) throw new Error("Supabase Admin client not initialized");

      // fileContent is expected to be Base64
      const buffer = Buffer.from(fileContent, 'base64');
      const filePath = `${folder || 'uploads'}/${fileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from('assets')
        .upload(filePath, buffer, {
          contentType: contentType || 'application/octet-stream',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('assets')
        .getPublicUrl(data.path);

      res.json({ success: true, url: publicUrl });
    } catch (error: any) {
      console.error("[Sovereign Server] Supabase Admin Upload Failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Public Endpoint: Proxy PDF to bypass Google Drive CSP block in iframes
  app.get("/api/pdf-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).send("Missing URL parameter");

      let response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

      const buffer = await response.arrayBuffer();
      let fileBuffer = Buffer.from(buffer);
      let contentType = response.headers.get('content-type') || 'application/pdf';

      // Handle Google Drive Virus Scan Warning Page
      if (contentType.includes('text/html')) {
        const htmlStr = fileBuffer.toString('utf-8');
        // Search for the confirmation URL: <a id="uc-download-link" href="/uc?export=download&amp;confirm=xxxx&amp;id=yyyy">
        // It could also just be form action, or href
        const match = htmlStr.match(/href="(\/uc\?export=download(?:&amp;|&)confirm=[^"]+)"/) || htmlStr.match(/href="(\/u\/0\/uc\?export=download(?:&amp;|&)confirm=[^"]+)"/);
        
        if (match) {
          const confirmPath = match[1].replace(/&amp;/g, '&');
          const confirmUrl = `https://drive.google.com${confirmPath}`;
          
          // Must pass the cookies sent by Drive back to it for the confirmation to work
          const cookies = response.headers.get('set-cookie');
          
          const headers: any = {};
          if (cookies) {
             headers['Cookie'] = cookies;
          }

          response = await fetch(confirmUrl, { headers });
          if (!response.ok) throw new Error(`Confirmation fetch failed: ${response.statusText}`);
          
          const newBuffer = await response.arrayBuffer();
          fileBuffer = Buffer.from(newBuffer);
          contentType = response.headers.get('content-type') || 'application/pdf';
        } else {
           // Fallback: If we couldn't find the confirm link, it might be an actual sign-in wall or blocked file. 
           // In this case, we'll gracefully fallback by letting the client know.
           if (htmlStr.includes('ServiceLogin') || htmlStr.includes('accounts.google.com')) {
              console.warn("Drive proxy hit a login wall. The file might not be public.");
           }
        }
      }

      res.setHeader('Content-Type', contentType.includes('text/html') ? 'application/pdf' : contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.send(fileBuffer);
    } catch (error: any) {
      console.error("[Sovereign Server] Public PDF Proxy Failed:", error.message);
      res.status(500).send("Error proxying the file: " + error.message);
    }
  });

  // New Endpoint: Fetch external file (Google Drive) and return Base64 to avoid CORS
  app.post("/api/proxy-fetch", async (req, res) => {
    try {
      await verifyAdmin(req);
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });

      let fetchUrl = url;
      // Convert common Google Drive links to download links if not already
      const isGoogleLink = /drive\.google\.com|docs\.google\.com\/file\/d\//i.test(url);
      if (isGoogleLink) {
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
           fetchUrl = `https://drive.google.com/uc?id=${idMatch[1]}&export=download`;
        }
      }

      let response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`Failed to fetch external resource: ${response.statusText}`);

      const buffer = await response.arrayBuffer();
      let fileBuffer = Buffer.from(buffer);
      let contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Handle Google Drive Virus Scan Warning Page
      if (contentType.includes('text/html') && isGoogleLink) {
        const htmlStr = fileBuffer.toString('utf-8');
        const match = htmlStr.match(/href="(\/uc\?export=download(?:&amp;|&)confirm=[^"]+)"/) || htmlStr.match(/href="(\/u\/0\/uc\?export=download(?:&amp;|&)confirm=[^"]+)"/);
        
        if (match) {
          const confirmPath = match[1].replace(/&amp;/g, '&');
          const confirmUrl = `https://drive.google.com${confirmPath}`;
          
          const cookies = response.headers.get('set-cookie');
          
          const headers: any = {};
          if (cookies) {
             headers['Cookie'] = cookies;
          }

          response = await fetch(confirmUrl, { headers });
          if (!response.ok) throw new Error(`Confirmation fetch failed: ${response.statusText}`);
          
          const newBuffer = await response.arrayBuffer();
          fileBuffer = Buffer.from(newBuffer);
          contentType = response.headers.get('content-type') || 'application/pdf';
        }
      }

      // If it is still HTML after all our bypass attempts, Google Drive is blocking the download
      // (either it requires login, rate limits, or completely disabled direct download for this file).
      if (contentType.includes('text/html')) {
          throw new Error("لا يمكن جلب الملف برمجياً، لأن غوغل درايف يمنع التنزيل المباشر لهذا الملف (قد يحتاج إلى تسجيل دخول، أو تم إيقاف التنزيل المباشر). يرجى تنزيل الملف يدوياً إلى جهازك ثم رفعه هنا بدلاً من استخدام الرابط.");
      }

      const base64 = fileBuffer.toString('base64');

      res.json({ 
        success: true, 
        fileContent: base64, 
        contentType,
        fileName: fetchUrl.split('/').pop()?.split('?')[0] || 'downloaded_file.pdf'
      });
    } catch (error: any) {
      console.error("[Sovereign Server] Proxy Fetch Failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // New Endpoint: Delete from Supabase Storage (Service Role)
  app.post("/api/delete-supabase", async (req, res) => {
    try {
      await verifyAdmin(req);
      const { filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: "filePath is required" });

      const supabaseAdmin = getSupabase();
      if (!supabaseAdmin) throw new Error("Supabase Admin client not initialized");

      const { error } = await supabaseAdmin.storage
        .from('assets')
        .remove([filePath]);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Sovereign Server] Supabase Deletion Failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // New Endpoint: Delete from GitHub Archive
  app.post("/api/deleteMedia", async (req, res) => {
    try {
      const { email } = await verifyAdmin(req);
      const { url } = req.body;

      if (!url) return res.status(400).json({ error: "URL is required" });

      // Check if it's a GitHub URL
      // https://raw.githubusercontent.com/owner/repo/branch/path
      if (!url.includes('raw.githubusercontent.com')) {
         return res.json({ success: true, message: "Not a GitHub URL, skipping GitHub deletion." });
      }

      const octokit = getOctokit();
      const urlParts = url.split('/');
      // parts: ["https:", "", "raw.githubusercontent.com", "owner", "repo", "branch", "path...", "file"]
      const pathStartIndex = 6;
      const filePath = urlParts.slice(pathStartIndex).join('/');

      if (!filePath) throw new Error("Could not extract file path from URL");

      // Get SHA
      let sha: string;
      try {
        const { data: fileDoc }: any = await octokit.rest.repos.getContent({
          owner: GITHUB_CONFIG.owner,
          repo: GITHUB_CONFIG.repo,
          path: filePath,
          ref: GITHUB_CONFIG.branch
        });
        sha = fileDoc.sha;
      } catch (e) {
        console.warn(`[Sophos Server] File not found on GitHub for deletion: ${filePath}`);
        return res.json({ success: true, message: "File already gone" });
      }

      await octokit.rest.repos.deleteFile({
        owner: GITHUB_CONFIG.owner,
        repo: GITHUB_CONFIG.repo,
        path: filePath,
        branch: GITHUB_CONFIG.branch,
        sha,
        message: `Delete media: ${filePath} by ${email}`
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Sophos Server] GitHub Deletion Failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Open Graph Share Endpoint
  app.get("/api/share", async (req: express.Request, res: express.Response) => {
    const viewId = req.query.view as string;
    
    if (!viewId) {
      return res.redirect('/');
    }

    try {
      const client = getSupabase();
      let dataObj: any = null;

      if (client) {
        const { data, error } = await client.from('settings').select('data').eq('id', 1).single();
        if (!error && data && data.data) {
          dataObj = data.data;
        }
      }

      if (!dataObj) {
         try {
           const octokit = getOctokit();
           const { data: fileData }: any = await octokit.rest.repos.getContent({
             owner: GITHUB_CONFIG.owner,
             repo: GITHUB_CONFIG.repo,
             path: GITHUB_CONFIG.dataPath,
             ref: GITHUB_CONFIG.branch
           });
           dataObj = JSON.parse(Buffer.from(fileData.content, 'base64').toString());
         } catch (e) {
           console.warn("Share endpoint failed to fetch Github fallback");
         }
      }

      if (!dataObj) {
        return res.redirect(`/?view=${viewId}`);
      }

      const { siteConfig, articles, categories } = dataObj;
      const article = (articles || []).find((a: any) => a.id === viewId);

      if (!article) {
        return res.redirect('/');
      }

      const category = (categories || []).find((c: any) => c.id === article.categoryId);

      const siteTitle = siteConfig?.siteTitle || "أرشيف بيج بوس";
      const ogTitleFormat = siteConfig?.ogTitleFormat || `{{title}} | ${siteTitle}`;
      const dynamicTitle = ogTitleFormat.replace('{{title}}', article.title);

      const description = article.content || siteConfig?.siteDescription || "وثيقة من الأرشيف السيادي";
      const ogImage = article.headerImage || siteConfig?.ogDefaultImage || siteConfig?.mainHeaderImage || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=2282";

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${dynamicTitle}</title>
    <meta name="description" content="${description.substring(0, 160)}">
    
    <!-- Open Graph / Meta Tags -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${dynamicTitle}">
    <meta property="og:description" content="${description.substring(0, 160)}">
    <meta property="og:image" content="${ogImage}">
    ${category ? `<meta property="article:section" content="${category.title}">` : ''}

    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${dynamicTitle}">
    <meta name="twitter:description" content="${description.substring(0, 160)}">
    <meta name="twitter:image" content="${ogImage}">

    <!-- Redirect script for real users -->
    <script>
      window.location.href = "/?view=${viewId}";
    </script>
</head>
<body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
    <h2>جاري التحويل إلى الأرشيف...</h2>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);

    } catch (error) {
      console.error("OpenGraph Share Error:", error);
      res.redirect(`/?view=${viewId}`);
    }
  });

  // API Error Catch-all (to prevent HTML fallthrough for /api)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found on this sovereign server.` });
  });

  // Vite / Static Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Sophos Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
