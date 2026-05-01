import { ExternalLink, Loader2, Download, X, Maximize2, Minimize2, Share2, Video } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PDFViewerProps {
  url: string;
  videoUrl?: string;
  title: string;
  articleId?: string;
  onClose?: () => void;
}

export default function PDFViewer({ url, videoUrl, title, articleId, onClose }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isVideo = !!videoUrl;

  const handleDownload = () => {
    if (isVideo) return;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleShare = async () => {
    const shareUrl = articleId 
      ? `${window.location.origin}/api/share?view=${articleId}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('تم نسخ الرابط بنجاح! يمكنك مشاركته الآن.');
    } catch (err) {
      console.error('Failed to copy', err);
      prompt('انسخ الرابط التالي:', shareUrl);
    }
  };

  const getEmbedUrl = (pdfUrl: string, vUrl?: string) => {
    if (vUrl) {
      try {
        const urlObj = new URL(vUrl);
        let videoId = '';
        if (urlObj.hostname.includes('youtube.com')) {
          videoId = urlObj.searchParams.get('v') || '';
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.split('/')[1] || '';
        }
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        }
      } catch (e) {
        return vUrl;
      }
      return vUrl;
    }
    if (!pdfUrl) return '';
    try {
      const isGoogleLink = /drive\.google\.com|docs\.google\.com\/file\/d\//i.test(pdfUrl);
      if (isGoogleLink) {
        const idMatch = pdfUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || pdfUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
           const id = idMatch[1];
           // Use standard Drive preview URL for iframe
           return `https://drive.google.com/file/d/${id}/preview`;
        }
      }
      
      // For Supabase links and any other direct PDF URLs, use Google Docs Viewer wrapper
      // This prevents the "Open" fallback prompt on Android/iOS when iframing raw PDFs
      return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
    } catch(e) {
      return pdfUrl;
    }
  };

  const getDirectUrl = (pdfUrl: string) => {
    if (!pdfUrl) return '';
    try {
      const isGoogleLink = /drive\.google\.com|docs\.google\.com\/file\/d\//i.test(pdfUrl);
      if (isGoogleLink) {
        const idMatch = pdfUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || pdfUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
           const id = idMatch[1];
           return `https://drive.google.com/file/d/${id}/view?usp=sharing`;
        }
      }
      return pdfUrl;
    } catch(e) {
      return pdfUrl;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`fixed inset-0 z-[10000] flex flex-col bg-black/40 backdrop-blur-sm p-4 md:p-12 font-sans`}
    >
      <div className={`relative flex flex-col bg-white rounded-3xl overflow-hidden w-full h-full shadow-2xl shadow-black/20 ${isFullscreen ? 'fixed inset-0 p-0 rounded-none z-[10001]' : 'max-w-6xl mx-auto'}`}>
        
        {/* Header Control Bar */}
        <div className="w-full bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-6 overflow-hidden">
              <button 
                onClick={onClose}
                className="p-3 bg-gray-50 hover:bg-black hover:text-white rounded-2xl transition-all duration-300 group"
                title="إغلاق"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
              <div className="flex flex-col overflow-hidden">
                  <h4 className="text-sm font-bold font-serif text-black truncate leading-tight">{title}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-sans">الأرشيف السيادي</span>
                    <div className="w-1 h-1 rounded-full bg-green-500" />
                    <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest font-sans italic flex items-center gap-1">
                      {isVideo && <Video size={10} />}
                      {isVideo ? 'مشاهدة الفيديو' : 'وضع القراءة النشط'}
                    </span>
                  </div>
              </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={handleShare}
                className="hidden md:flex p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-500 hover:text-black gap-2 items-center text-xs font-bold"
                title="مشاركة المستند"
              >
                <Share2 size={18} />
                <span className="hidden lg:inline">مشاركة</span>
              </button>

              <button
                onClick={toggleFullscreen}
                className="hidden md:flex p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-500 hover:text-black gap-2 items-center text-xs font-bold"
                title={isFullscreen ? "تصغير" : "ملء الشاشة"}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span className="hidden lg:inline">{isFullscreen ? 'تصغير الواجهة' : 'توسيع العرض'}</span>
              </button>

              {!isVideo && (
                <button
                  onClick={handleDownload}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all text-gray-600 hover:text-black"
                  title="تحميل"
                >
                  <Download size={18} />
                </button>
              )}

              <a
                href={isVideo ? videoUrl : getDirectUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-black text-white rounded-2xl transition-all hover:bg-gray-800 flex items-center gap-2 text-xs font-bold px-5 shrink-0"
              >
                <span className="hidden sm:inline">{isVideo ? 'فتح في يوتيوب' : 'فتح في نافذة مستقلة'}</span>
                <ExternalLink size={14} />
              </a>
          </div>
        </div>

        {/* The Frame Body */}
        <div className="flex-1 relative bg-gray-50 flex flex-col overflow-hidden items-center">
          {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-md z-10 pointer-events-none">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-black animate-spin mb-6" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-black rounded-full" />
                    </div>
                  </div>
                  <p className="text-black font-serif font-bold text-lg">{isVideo ? 'جاري تشغيل الفيديو...' : 'جاري جلب الملف الآمن...'}</p>
                  {!isVideo && (
                    <div className="mt-4 p-4 max-w-sm bg-yellow-50 border border-yellow-200 rounded-2xl text-center shadow-lg">
                      <p className="text-xs text-yellow-800 font-bold leading-relaxed font-sans">
                        ملاحظة: إذا لم يظهر الملف بعد لحظات، أو ظهرت لك شاشة رمادية، يرجى الضغط على رز <strong className="text-black inline-flex"><ExternalLink size={12} className="mx-1" />فتح في نافذة مستقلة</strong> في الأعلى. هذا طبيعي جداً عند استخدام روابط Google Drive داخل بيئة التجربة (Preview).
                      </p>
                    </div>
                  )}
              </div>
          )}
          
          <iframe 
              src={getEmbedUrl(url, videoUrl)}
              className="w-full h-full border-none shadow-inner bg-white"
              onLoad={() => setIsLoading(false)}
              allow="autoplay; encrypted-media; fullscreen"
              title={title}
          />
        </div>
        
        {/* Footer info (optional) */}
        <div className="px-8 py-3 bg-white border-t border-gray-100 flex items-center justify-between shrink-0">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest font-sans">
              {isVideo ? 'YouTube Media Stream • Internal Release' : 'Secure PDF Stream • Internal Release'}
            </div>
            <div className="text-[10px] font-bold text-gray-300 font-sans italic">
              Archived & Managed by The Sovereign Repository
            </div>
        </div>
      </div>
    </motion.div>
  );
}
