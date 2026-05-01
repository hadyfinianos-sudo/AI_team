import { createClient } from '@supabase/supabase-js';

// 1. تنظيف الرابط بشكل قوي والتأكد من أنه الرابط الأساسي فقط
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.split('/rest/v1')[0].split('/auth/v1')[0].replace(/\/$/, "");

// 2. الحصول على مفتاح الـ Anon
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

// تشخيص أولي في الكونسول للمساعدة في تتبع المشكلة
if (typeof window !== 'undefined') {
  console.log("[Sovereign Auth] Initializing client with:", {
    url: supabaseUrl || "MISSING",
    hasKey: !!supabaseAnonKey,
    keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + "..." : "NONE"
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[Sovereign] CRITICAL: Supabase URL or Anon Key is missing! Check your Vercel/AI Studio Environment Variables.");
}

/**
 * العميل السيادي لـ Supabase
 * نقوم بإضافة apikey بشكل صريح في الهيدرز لتجنب خطأ "No API key found in request"
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'X-Client-Info': 'sovereign-archive-web'
    }
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const MASTER_ADMINS = ["hady.finianos@gmail.com", "hadyfinianos@gmail.com"];

/**
 * Enhanced Fetch Wrapper to ensure Supabase Headers are always present
 */
export const sovereignFetch = async (url: string, options: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || supabaseAnonKey;
  
  const headers = {
    ...options.headers,
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${token}`
  };

  // Ensure absolute URL to prevent 405 or routing errors on Vercel
  let absoluteUrl = url;
  if (url.startsWith('/') && typeof window !== 'undefined') {
    absoluteUrl = `${window.location.origin}${url}`;
  }

  return fetch(absoluteUrl, { ...options, headers });
};

/**
 * Centralized Admin Verification Logic
 */
export const checkIsAdmin = (email: string | undefined, registryAdmins: any[] = []) => {
  if (!email) {
    console.log("[Sovereign Auth] Access Denied: No email provided");
    return false;
  }
  
  const lowerEmail = email.toLowerCase().trim();
  console.log(`[Sovereign Auth] Verification attempt for: ${lowerEmail}`);
  
  // 1. MASTER_ADMINS check
  if (MASTER_ADMINS.some(m => m.toLowerCase() === lowerEmail)) {
    console.log("[Sovereign Auth] Access GRANTED: Master Admin detected");
    return true;
  }
  
  // 2. Dynamic registry admins check
  const adminList = Array.isArray(registryAdmins) ? registryAdmins : [];
  const isAltAdmin = adminList.some(a => 
    typeof a === 'string' && a.toLowerCase().trim() === lowerEmail
  );

  if (isAltAdmin) {
    console.log("[Sovereign Auth] Access GRANTED: Registry Admin detected");
    return true;
  }
  
  console.log("[Sovereign Auth] Access DENIED: Email not in authorized list");
  return false;
};

/**
 * Converts a file to base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:xxxxx;base64, prefix
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Uploads a file to Supabase via server proxy (bypasses RLS)
 */
export const uploadToSupabase = async (file: File, folder: string = 'uploads') => {
  const fileContent = await fileToBase64(file);
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  const response = await sovereignFetch('/api/upload-supabase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName,
      fileContent,
      folder,
      contentType: file.type
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'فشل الرفع عبر الخادم');
  }

  return result.url;
};

/**
 * Fetches an external file (like Google Drive) and uploads it to Supabase via server proxy
 */
export const fetchExternalAndUpload = async (externalUrl: string, folder: string = 'uploads') => {
  // 1. Fetch the file data via server proxy to avoid CORS
  const fetchResponse = await sovereignFetch('/api/proxy-fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: externalUrl })
  });

  const fetchResult = await fetchResponse.json();
  if (!fetchResponse.ok || !fetchResult.success) {
    throw new Error(fetchResult.error || 'فشل جلب الملف الخارجي');
  }

  // 2. Upload the fetched content to Supabase
  const uploadResponse = await sovereignFetch('/api/upload-supabase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: fetchResult.fileName,
      fileContent: fetchResult.fileContent,
      folder,
      contentType: fetchResult.contentType
    })
  });

  const uploadResult = await uploadResponse.json();
  if (!uploadResponse.ok || !uploadResult.success) {
    throw new Error(uploadResult.error || 'فشل رفع الملف المجلوب');
  }

  return uploadResult.url;
};

/**
 * Deletes a file from Supabase Storage via server proxy
 */
export const deleteFromSupabase = async (url: string) => {
  if (!url || !url.includes('supabase.co')) return;
  
  try {
    // Extract path from public URL
    // Format: https://[project-id].supabase.co/storage/v1/object/public/assets/[path]
    const pathParts = url.split('/assets/');
    if (pathParts.length < 2) return;
    
    const filePath = pathParts[1];
    
    const response = await sovereignFetch('/api/delete-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
      
    if (!response.ok) {
      const err = await response.json();
      console.warn("Supabase Delete Error (ignoring):", err.error);
    }
  } catch (e) {
    console.error("Failed to parse/delete Supabase URL:", e);
  }
};
