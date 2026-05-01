import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface VercelRequest extends IncomingMessage {
  headers: any;
  query: { [key: string]: string | string[] };
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  send: (html: string) => void;
}

const getSupabase = () => {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!rawUrl || !key) return null;
  const url = rawUrl.split('/rest/v1')[0].split('/auth/v1')[0].replace(/\/$/, "");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { 'apikey': key } } });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const viewId = req.query.view as string;
  
  if (!viewId) {
    res.setHeader('Location', '/');
    res.status(302).send('Redirecting...');
    return;
  }

  try {
    const supabase = getSupabase();
    let dataObj: any = null;

    if (supabase) {
      const { data } = await supabase.from('settings').select('data').eq('id', 1).single();
      if (data && data.data) {
        dataObj = data.data;
      }
    }

    if (!dataObj) {
      // Fallback
      res.setHeader('Location', `/?view=${viewId}`);
      res.status(302).send('Redirecting...');
      return;
    }

    const { siteConfig, articles, categories } = dataObj;
    const article = (articles || []).find((a: any) => a.id === viewId);

    if (!article) {
      res.setHeader('Location', '/');
      res.status(302).send('Redirecting...');
      return;
    }

    const category = (categories || []).find((c: any) => c.id === article.categoryId);

    const siteTitle = siteConfig?.siteTitle || "أرشيف بيج بوس";
    const ogTitleFormat = siteConfig?.ogTitleFormat || `{{title}} | ${siteTitle}`;
    const dynamicTitle = ogTitleFormat.replace('{{title}}', article.title);

    const description = article.content || siteConfig?.siteDescription || "وثيقة من الأرشيف السيادي";
    const ogImage = article.headerImage || siteConfig?.ogDefaultImage || siteConfig?.mainHeaderImage || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=2282";

    const html = `
<!DOCTYPE html>
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
    res.status(200).send(html);

  } catch (error) {
    console.error("OpenGraph Share Error:", error);
    res.setHeader('Location', `/?view=${viewId}`);
    res.status(302).send('Error, Redirecting...');
  }
}
