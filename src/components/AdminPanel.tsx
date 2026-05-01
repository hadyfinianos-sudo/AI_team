// Testing Persistent Storage Deployment
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Save, X, LogOut, Layout, FilePlus, Image as ImageIcon, Settings, Upload, Loader2, FileText, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { githubService } from '../services/githubService';
import ContentManager from './admin/ContentManager';
import SovereignSettings from './admin/SovereignSettings';
import DynamicTheme from './DynamicTheme';
import { supabase, sovereignFetch, MASTER_ADMINS, checkIsAdmin, uploadToSupabase, deleteFromSupabase, fetchExternalAndUpload } from '../lib/supabase';

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const isMasterAdmin = (email?: string) => {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    return MASTER_ADMINS.some(m => m.toLowerCase() === lowerEmail);
  };
  
  const [data, setData] = useState({
    siteConfig: { 
      siteTitle: '', 
      siteDescription: '', 
      mainHeaderImage: '', 
      version: 'v1.0.0',
      siteBgColor: '#ffffff',
      primaryFontColor: '#000000',
      secondaryFontColor: '#9ca3af',
      btnBgColor: '#000000',
      btnTextColor: '#ffffff',
      externalLinks: [] as any[]
    },
    categories: [] as any[],
    articles: [] as any[],
    admins: [] as string[]
  });

  const [newCategory, setNewCategory] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newArticle, setNewArticle] = useState({ 
    title: '', 
    content: '', 
    pdfUrl: '', 
    videoUrl: '',
    headerImage: '', 
    imagePosition: 'center' as 'top' | 'center' | 'bottom', 
    categoryId: '', 
    categoryIds: [] as string[] 
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [mainHeaderFile, setMainHeaderFile] = useState<File | null>(null);
  const [ogDefaultImageFile, setOgDefaultImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [editingSite, setEditingSite] = useState(false);

  const getNextVersion = (current: string) => {
    if (!current) return "v1.0.0";
    const parts = current.replace('v', '').split('.').map(Number);
    if (parts.length < 3) return "v1.0.0";
    parts[2] += 1;
    if (parts[2] >= 10) { parts[2] = 0; parts[1] += 1; }
    if (parts[1] >= 10) { parts[1] = 0; parts[0] += 1; }
    return `v${parts.join('.')}`;
  };

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user?.email) {
        await fetchData(session.user.email);
      } else {
        setIsAuthChecking(false);
        setLoading(false);
      }

      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user?.email) {
          fetchData(session.user.email);
        } else {
          setIsAdminUser(false);
          setLoading(false);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    };

    initialize();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/admin'
        }
      });
      if (error) throw error;
    } catch (e: any) {
      alert("خطأ في تسجيل دخول Google: " + e.message + "\n\nيرجى التأكد من تفعيل Google Provider في لوحة تحكم Supabase.");
    }
  };

  const fetchData = async (currentEmail?: string) => {
    console.log("[Admin Panel] Fetching registry data for:", currentEmail);
    const isOwner = isMasterAdmin(currentEmail);
    if (isOwner) setIsAdminUser(true);

    try {
      const json = await githubService.fetchRegistry();
      
      // دمج البيانات المستلمة مع القيم الافتراضية لضمان عدم وجود undefined
      const mergedData = {
        ...data, // البداية بالقيم الحالية (الافتراضية)
        ...json, // دمج البيانات الجديدة
        siteConfig: { 
          ...(data.siteConfig || {}), 
          ...(json?.siteConfig || {}) 
        },
        categories: Array.isArray(json?.categories) ? json.categories : (data.categories || []),
        articles: Array.isArray(json?.articles) ? json.articles : (data.articles || []),
        admins: Array.isArray(json?.admins) ? json.admins : (data.admins || [])
      };

      console.log("[Admin Panel] Data merged and synced.");
      setData(mergedData);

      if (currentEmail) {
        setIsAdminUser(checkIsAdmin(currentEmail, mergedData.admins || []));
      }
    } catch (e) {
      console.error("Error fetching data:", e);
      if (isOwner) setIsAdminUser(true);
    } finally {
      setLoading(false);
      setIsAuthChecking(false);
    }
  };

  const saveData = async (newData: any, logAction?: string, logTarget?: string) => {
    setIsSaving(true);
    try {
      await githubService.commitUpdate(newData, logAction, logTarget);
      setData(newData);
    } catch (e: any) {
      console.error("Save data failed:", e);
      let errorMsg = e.message;
      if (errorMsg.includes("Unauthorized") || errorMsg.includes("session")) {
        errorMsg += "\n\nنصيحة: إذا كنت تستخدم الهاتف من داخل تطبيق آخر، يرجى فتح الموقع في المتصفح العادي (Safari/Chrome) لضمان استقرار الجلسة.";
      }
      alert("خطأ أثناء الحفظ:\n" + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const uploadFile = async (file: File, fieldName: string): Promise<string> => {
    const folder = fieldName === 'pdf' ? 'documents' : 'images';
    const url = await uploadToSupabase(file, folder);
    setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
    return url;
  };

  const handleUpdateTheme = async () => {
    setUploading(true);
    try {
      const updatedConfig = { ...(data?.siteConfig || {}) };
      if (mainHeaderFile) {
        const url = await uploadFile(mainHeaderFile, 'mainHeader');
        updatedConfig.mainHeaderImage = url;
      }
      if (ogDefaultImageFile) {
        const url = await uploadFile(ogDefaultImageFile, 'ogDefault');
        updatedConfig.ogDefaultImage = url;
      }
      updatedConfig.version = getNextVersion(updatedConfig.version || 'v1.0.0');
      
      const newData = { ...data, siteConfig: updatedConfig };
      await saveData(newData, "UPDATE_THEME", "SITE_CONFIG");
      setMainHeaderFile(null);
      setOgDefaultImageFile(null);
      alert("تم تحديث إعدادات المظهر بنجاح!");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateSite = async () => {
    setUploading(true);
    try {
      const updatedConfig = { ...(data?.siteConfig || {}) };
      if (mainHeaderFile) {
        const url = await uploadFile(mainHeaderFile, 'mainHeader');
        updatedConfig.mainHeaderImage = url;
      }
      if (ogDefaultImageFile) {
        const url = await uploadFile(ogDefaultImageFile, 'ogDefault');
        updatedConfig.ogDefaultImage = url;
      }
      updatedConfig.version = getNextVersion(updatedConfig.version || 'v1.0.0');
      
      const newData = { ...data, siteConfig: updatedConfig };
      await saveData(newData, "UPDATE_SITE_CONFIG", "SITE_CONFIG");
      setMainHeaderFile(null);
      setOgDefaultImageFile(null);
      setEditingSite(false);
      alert("تم تحديث البيانات بنزاح يا زعيم!");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory) return;
    const newCat = {
      id: Date.now().toString(),
      title: newCategory,
      order: (data.categories || []).length + 1
    };
    const newData = {
      ...data,
      categories: [...(data.categories || []), newCat],
      siteConfig: { ...(data?.siteConfig || {}), version: getNextVersion(data?.siteConfig?.version || 'v1.0.0') }
    };
    await saveData(newData, "ADD_CATEGORY", `تم إضافة تصنيف جديد: ${newCategory}`);
    setNewCategory('');
  };

  const handleUpdateCategory = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const newData = {
        ...data,
        categories: (data?.categories || []).map((cat: any) => 
          cat.id === id ? { ...cat, title: newTitle } : cat
        ),
        siteConfig: { ...(data?.siteConfig || {}), version: getNextVersion(data?.siteConfig?.version || 'v1.0.0') }
      };
      await saveData(newData, "UPDATE_CATEGORY", `تم تعديل اسم القسم: ${newTitle}`);
    } catch (e: any) {
      alert("خطأ أثناء تعديل القسم: " + e.message);
    }
  };

  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);

  const handleAddArticle = async () => {
    if (!newArticle.title.trim() || (!newArticle.categoryId && (!newArticle.categoryIds || newArticle.categoryIds.length === 0))) {
      alert('يرجى إكمال البيانات المطلوبة');
      return;
    }
    setUploading(true);
    try {
      let finalPdfUrl = newArticle.pdfUrl;
      let finalHeaderImage = newArticle.headerImage;

      // Handle PDF Source
      if (pdfFile) {
        // Local file upload
        finalPdfUrl = await uploadFile(pdfFile, 'pdf');
      } else if (newArticle.pdfUrl) {
        // Keep external URL as is
        finalPdfUrl = newArticle.pdfUrl;
      }

      if (headerImageFile) finalHeaderImage = await uploadFile(headerImageFile, 'image');

      if (editingArticleId) {
        // Update existing article
        const newData = {
          ...data,
          articles: (data.articles || []).map((art: any) => 
            art.id === editingArticleId 
              ? { ...art, ...newArticle, pdfUrl: finalPdfUrl, headerImage: finalHeaderImage, updatedAt: { seconds: Math.floor(Date.now() / 1000) } }
              : art
          ),
          siteConfig: { ...(data?.siteConfig || {}), version: getNextVersion(data?.siteConfig?.version || 'v1.0.0') }
        };
        await saveData(newData, "UPDATE_ARTICLE", `تم تعديل الوثيقة: ${newArticle.title}`);
        alert("تم تحديث المقال بنجاح!");
      } else {
        // Create new article
        const article = {
          id: Date.now().toString(),
          ...newArticle,
          pdfUrl: finalPdfUrl,
          headerImage: finalHeaderImage,
          createdAt: { seconds: Math.floor(Date.now() / 1000) }
        };

        const newData = {
          ...data,
          articles: [article, ...(data.articles || [])],
          siteConfig: { ...(data?.siteConfig || {}), version: getNextVersion(data?.siteConfig?.version || 'v1.0.0') }
        };
        await saveData(newData, "ADD_ARTICLE", `تم إضافة مقال/وثيقة جديدة: ${newArticle.title}`);
        alert("تم نشر المقال بنجاح!");
      }
      
      setNewArticle({ 
        title: '', 
        content: '', 
        pdfUrl: '', 
        videoUrl: '',
        headerImage: '', 
        imagePosition: 'center', 
        categoryId: '', 
        categoryIds: [] 
      });
      setPdfFile(null);
      setHeaderImageFile(null);
      setEditingArticleId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (type: 'categories' | 'articles' | 'admins', id: string) => {
    try {
      if (!confirm('هل أنت متأكد؟')) return;
      let newData = { ...data, siteConfig: { ...(data?.siteConfig || {}) } };
      let logTarget = id;
      if (type === 'categories') {
        const cat = (data?.categories || []).find(c => c.id === id);
        logTarget = cat?.title || id;
        newData.categories = (data?.categories || []).filter(c => c.id !== id);
      }
      if (type === 'articles') {
         const art = (data?.articles || []).find((a: any) => a.id === id);
         logTarget = art?.title || id;
         newData.articles = (data?.articles || []).map(a => 
           a.id === id ? { ...a, isDeleted: true, deletedAt: Math.floor(Date.now() / 1000) } : a
         );
      }
      if (type === 'admins') newData.admins = (data?.admins || []).filter(email => email !== id);
      
      newData.siteConfig.version = getNextVersion(data?.siteConfig?.version || 'v1.0.0');
      await saveData(newData, `DELETE_${type.toUpperCase().slice(0, -1)}`, logTarget);
    } catch (e: any) {
      alert("خطأ أثناء الحذف: " + e.message);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) return;
    const trimmed = newAdminEmail.toLowerCase().trim();
    if (data.admins.includes(trimmed)) return;
    const newData = {
      ...data,
      admins: [...(data.admins || []), trimmed]
    };
    await saveData(newData, "ADD_ADMIN", `تم إضافة مسؤول جديد: ${trimmed}`);
    setNewAdminEmail('');
  };

  const handleRestoreArticle = async (id: string) => {
    let newData = { ...data, siteConfig: { ...(data?.siteConfig || {}) } };
    const art = (data?.articles || []).find((a: any) => a.id === id);
    if (!art) return;
    
    newData.articles = (data?.articles || []).map((a: any) => 
      a.id === id ? { ...a, isDeleted: false, deletedAt: undefined } : a
    );
    newData.siteConfig.version = getNextVersion(data?.siteConfig?.version || 'v1.0.0');
    await saveData(newData, "RESTORE_ARTICLE", art.title);
  };

  const handlePermanentDeleteArticle = async (id: string) => {
    try {
      if (!confirm('هل أنت متأكد من الحذف النهائي؟ لا يمكن التراجع عن هذا الإجراء.')) return;
      let newData = { ...data, siteConfig: { ...(data?.siteConfig || {}) } };
      const art = (data?.articles || []).find((a: any) => a.id === id);
      if (!art) return;

      // Delete associated media files from all storage (Cloud + GitHub)
      if (art.pdfUrl) {
        await deleteFromSupabase(art.pdfUrl);
        await githubService.deleteMedia(art.pdfUrl);
      }
      if (art.headerImage) {
        await deleteFromSupabase(art.headerImage);
        await githubService.deleteMedia(art.headerImage);
      }

      newData.articles = (data?.articles || []).filter((a: any) => a.id !== id);
      newData.siteConfig.version = getNextVersion(data?.siteConfig?.version || 'v1.0.0');
      await saveData(newData, "PERMANENT_DELETE_ARTICLE", art.title);
    } catch (e: any) {
      alert("خطأ أثناء الحذف النهائي: " + e.message);
    }
  };

  // Cron-like functionality for cleanup
  useEffect(() => {
    const cleanupOldDeletedArticles = async () => {
      const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);
      let needsCleanup = false;

      // Filter and delete media concurrently (for any that need it)
      const cleaningPromises: Promise<any>[] = [];
      const articles = Array.isArray(data?.articles) ? data.articles : [];

      const newArticles = articles.filter((a: any) => {
        if (a.isDeleted && a.deletedAt) {
          if (now - a.deletedAt > THIRTY_DAYS_IN_SECONDS) {
             needsCleanup = true;
             console.log(`[Cron] Permanently deleting article ${a.id} as it's older than 30 days.`);
             if (a.pdfUrl) cleaningPromises.push(deleteFromSupabase(a.pdfUrl));
             if (a.headerImage) cleaningPromises.push(deleteFromSupabase(a.headerImage));
             return false;
          }
        }
        return true;
      });

      if (needsCleanup && isSovereign) {
        await Promise.all(cleaningPromises);
        const newData = { ...data, articles: newArticles, siteConfig: { ...data?.siteConfig } };
        newData.siteConfig.version = getNextVersion(newData.siteConfig.version);
        // Only one admin should ideally trigger this to avoid race conditions but for SPA it triggers per view
        saveData(newData, "CRON_CLEANUP", "Old Articles Data");
      }
    };

    if ((data?.articles || []).length > 0) {
       cleanupOldDeletedArticles();
    }
  }, [(data?.articles || []).length]);

  const [viewMode, setViewMode] = useState<'content' | 'sovereign'>('content');
  const [activeSubTab, setActiveSubTab] = useState<'staff' | 'settings' | 'monitor'>('staff');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await sovereignFetch('/api/logs');
      const json = await response.json();
      setLogs(Array.isArray(json.logs) ? json.logs : (Array.isArray(json) ? json : []));
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'monitor' && viewMode === 'sovereign') {
      fetchLogs();
    }
  }, [activeSubTab, viewMode]);

  const handleDeleteLog = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل بشكل نهائي؟')) return;
    try {
      const response = await sovereignFetch(`/api/logs?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        let errorMsg = "Failed to delete log";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {
          // Fallback if response is not JSON
          const text = await response.text();
          if (text) errorMsg = text.substring(0, 100);
        }
        throw new Error(errorMsg);
      }
      setLogs(prev => prev.filter(l => l.id !== id));
      alert("تم الحذف بنجاح من كافة السجلات.");
    } catch (e: any) {
      console.error("Log deletion failed:", e);
      alert("خطأ أثناء الحذف: " + e.message);
    }
  };

  const isSovereign = isMasterAdmin(user?.email);

  // Protection: Redirect general admins away from sovereign view
  useEffect(() => {
    if (!isSovereign && viewMode === 'sovereign') {
      setViewMode('content');
    }
  }, [viewMode, isSovereign]);

  if (isAuthChecking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white font-serif">
      <Loader2 className="w-12 h-12 text-black animate-spin mb-6" />
      <h2 className="text-xl font-bold mb-2">التحقق من الهوية...</h2>
      <p className="text-gray-400 italic">برجاء الانتظار قليلاً لتأمين الاتصال</p>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white font-serif">
      <Loader2 className="w-12 h-12 text-gray-200 animate-spin mb-6" />
      <h2 className="text-xl font-bold text-gray-400 mb-2">جاري تحميل البيانات السيادية...</h2>
      <p className="text-gray-300 italic">يتم الآن جلب الأرشيف من الخوادم المؤمنة</p>
    </div>
  );

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center">
        <Globe className="w-16 h-16 text-gray-200 mx-auto mb-6" />
        <h2 className="text-2xl font-bold font-serif mb-2">الدخول الآمن</h2>
        <p className="text-gray-400 text-sm mb-8">يجب إثبات الهوية للوصول إلى لوحة التحكم</p>
        
        <div className="space-y-6">
          <button 
            onClick={async () => {
              await loginWithGoogle();
            }} 
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 text-gray-700 py-5 rounded-2xl font-bold hover:bg-gray-50 hover:border-black transition-all shadow-sm group"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
            <span>تسجيل الدخول عبر Google</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-red-50 rounded-3xl border border-red-100 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4 font-serif">وصول غير مصرح به</h2>
        <p className="text-red-500/70 text-sm mb-4">بريدك الإلكتروني غير مضاف في قائمة المدراء المعتمدين.</p>
        <p className="text-[10px] bg-red-100 text-red-600 px-3 py-1 rounded-full inline-block font-mono mb-8">{user.email}</p>
        <div>
          <button onClick={logout} className="bg-red-600 text-white px-8 py-2 rounded-full font-bold">خروج</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <DynamicTheme config={data?.siteConfig} />
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden min-h-[800px] flex flex-col">
          
          {/* Header */}
          <header className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-white shrink-0">
            <div className="flex items-center gap-6">
               <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10">
                  <Layout size={24} />
               </div>
               <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-serif">
                    {viewMode === 'sovereign' ? 'لوحة التحكم السيادية' : 'لوحة التحكم'}
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-gray-500 font-serif text-sm">أهلاً بك</p>
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-sans tracking-widest">{data?.siteConfig?.version || 'v1.0.0'}</span>
                    {isSovereign && <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-sans tracking-widest uppercase">Master Admin</span>}
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-3">
                 {isSaving && <span className="text-[10px] text-blue-500 animate-pulse font-bold">جاري المزامنة...</span>}
                 
                 <button 
                  onClick={() => navigate('/')} 
                  className="text-gray-900 hover:bg-gray-100 transition-all flex items-center gap-2 font-sans font-bold text-xs uppercase tracking-widest bg-gray-50 px-5 py-2.5 rounded-xl border border-gray-100"
                 >
                    <Globe size={16} />
                    عرض الموقع
                 </button>

                 <button 
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }} 
                  className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 font-sans font-bold text-xs uppercase tracking-widest px-4 py-2"
                 >
                    <LogOut size={16} />
                    خروج
                </button>
            </div>
          </header>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 border-l border-gray-100 bg-gray-50/30 p-6 flex flex-col gap-2 shrink-0">
               {viewMode === 'content' ? (
                 <>
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Content Dashboard</h4>
                   <button 
                    disabled
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-serif bg-black text-white shadow-lg text-right w-full"
                   >
                     <FilePlus size={18} />
                     <span className="flex-1">إدارة المحتوى</span>
                   </button>
                 </>
               ) : (
                 <>
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">System Control</h4>
                   <button 
                    onClick={() => setActiveSubTab('staff')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-serif text-right w-full ${activeSubTab === 'staff' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
                   >
                     <Globe size={18} />
                     <span className="flex-1">طاقم الإدارة</span>
                   </button>
                   <button 
                    onClick={() => setActiveSubTab('settings')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-serif text-right w-full ${activeSubTab === 'settings' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
                   >
                     <Settings size={18} />
                     <span className="flex-1">إعدادات النظام</span>
                   </button>
                   <button 
                    onClick={() => setActiveSubTab('monitor')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-serif text-right w-full ${activeSubTab === 'monitor' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
                   >
                     <FileText size={18} />
                     <span className="flex-1 text-sm font-bold">مراقبة التعديلات</span>
                   </button>

                   <div className="mt-8 border-t border-gray-100 pt-4">
                      <button 
                        onClick={() => setViewMode('content')}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-serif text-right w-full text-blue-600 hover:bg-blue-50"
                      >
                        <FileText size={18} />
                        <span className="flex-1 text-sm font-bold">العودة لإدارة المحتوى</span>
                      </button>
                   </div>
                 </>
               )}

               {/* Sovereign Chamber Switch (Only for Master) */}
               {isSovereign && viewMode === 'content' && (
                 <div className="mt-auto border-t border-gray-100 pt-6">
                    <button 
                      onClick={() => setViewMode('sovereign')}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-serif text-right w-full text-gray-300 hover:text-gray-900 group"
                    >
                      <Settings size={14} className="group-hover:rotate-90 transition-transform duration-500" />
                      <span className="flex-1 text-[10px] font-bold uppercase tracking-widest">Sovereign Chamber</span>
                    </button>
                 </div>
               )}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
              <AnimatePresence mode="wait">
                {viewMode === 'content' && (
                  <ContentManager 
                    data={data}
                    newArticle={newArticle}
                    setNewArticle={(art: any) => {
                      setNewArticle(art);
                      if (art.id) setEditingArticleId(art.id);
                    }}
                    newCategory={newCategory}
                    setNewCategory={setNewCategory}
                    handleAddArticle={handleAddArticle}
                    handleAddCategory={handleAddCategory}
                    handleDelete={handleDelete as any}
                    uploading={uploading}
                    isSaving={isSaving}
                    setPdfFile={setPdfFile}
                    setHeaderImageFile={setHeaderImageFile}
                    pdfFile={pdfFile}
                    headerImageFile={headerImageFile}
                    isEditing={!!editingArticleId}
                    cancelEdit={() => {
                      setEditingArticleId(null);
                      setNewArticle({ 
                        title: '', 
                        content: '', 
                        pdfUrl: '', 
                        videoUrl: '',
                        headerImage: '', 
                        imagePosition: 'center', 
                        categoryId: '', 
                        categoryIds: [] as string[] 
                      });
                      setPdfFile(null);
                      setHeaderImageFile(null);
                    }}
                    handleUpdateCategory={handleUpdateCategory}
                  />
                )}

                {viewMode === 'sovereign' && isSovereign && (
                  <SovereignSettings 
                    data={data}
                    setData={setData}
                    isSaving={isSaving}
                    uploading={uploading}
                    handleUpdateTheme={handleUpdateTheme}
                    newAdminEmail={newAdminEmail}
                    setNewAdminEmail={setNewAdminEmail}
                    handleAddAdmin={handleAddAdmin}
                    handleDelete={handleDelete as any}
                    MASTER_ADMINS={MASTER_ADMINS}
                    activeSubTab={activeSubTab}
                    setActiveSubTab={setActiveSubTab}
                    mainHeaderFile={mainHeaderFile}
                    setMainHeaderFile={setMainHeaderFile}
                    ogDefaultImageFile={ogDefaultImageFile}
                    setOgDefaultImageFile={setOgDefaultImageFile}
                    logs={logs}
                    loadingLogs={loadingLogs}
                    handleDeleteLog={handleDeleteLog}
                    fetchLogs={fetchLogs}
                    handleRestoreArticle={handleRestoreArticle}
                    handlePermanentDeleteArticle={handlePermanentDeleteArticle}
                  />
                )}
              </AnimatePresence>
            </main>
          </div>

          <footer className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center text-[8px] font-bold text-gray-400 uppercase tracking-widest px-8">
             <div>Sovereign OS Admin Framework v2.4</div>
             <div className="flex items-center gap-4">
                <span>Encryption Active</span>
                <span>•</span>
                <span>Session Secure</span>
             </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
