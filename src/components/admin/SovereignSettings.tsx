import { Plus, Trash2, Globe, Settings, Upload, X, Loader2, Save, Image as ImageIcon, FileText, ArchiveRestore, LayoutList, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface SovereignSettingsProps {
  data: any;
  setData: (data: any) => void;
  isSaving: boolean;
  uploading: boolean;
  handleUpdateTheme: () => Promise<void>;
  newAdminEmail: string;
  setNewAdminEmail: (email: string) => void;
  handleAddAdmin: () => Promise<void>;
  handleDelete: (type: 'admins', id: string) => Promise<void>;
  MASTER_ADMINS: string[];
  activeSubTab: 'staff' | 'settings' | 'monitor';
  setActiveSubTab: (tab: 'staff' | 'settings' | 'monitor') => void;
  mainHeaderFile: File | null;
  setMainHeaderFile: (file: File | null) => void;
  ogDefaultImageFile: File | null;
  setOgDefaultImageFile: (file: File | null) => void;
  logs?: any[];
  loadingLogs?: boolean;
  handleDeleteLog?: (id: string) => Promise<void>;
  fetchLogs?: () => Promise<void>;
  handleRestoreArticle?: (id: string) => Promise<void>;
  handlePermanentDeleteArticle?: (id: string) => Promise<void>;
}

export default function SovereignSettings({
  data,
  setData,
  isSaving,
  uploading,
  handleUpdateTheme,
  newAdminEmail,
  setNewAdminEmail,
  handleAddAdmin,
  handleDelete,
  MASTER_ADMINS,
  activeSubTab,
  setActiveSubTab,
  mainHeaderFile,
  setMainHeaderFile,
  ogDefaultImageFile,
  setOgDefaultImageFile,
  logs = [],
  loadingLogs = false,
  handleDeleteLog,
  fetchLogs,
  handleRestoreArticle,
  handlePermanentDeleteArticle
}: SovereignSettingsProps) {
  return (
    <div className="max-w-5xl space-y-12">
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-gray-100 pb-6 gap-4">
        <h2 className="text-2xl font-bold font-serif leading-tight">إدارة النظام السيادي</h2>
        <div className="flex gap-2">
          {activeSubTab === 'monitor' && (
            <button 
              onClick={fetchLogs}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              {loadingLogs ? <Loader2 className="animate-spin" size={14} /> : <Settings size={14} />}
              تحديث السجلات
            </button>
          )}
          <button 
            onClick={() => setData({ 
              ...data, 
              siteConfig: { 
                ...(data?.siteConfig || {}), 
                siteBgColor: '#ffffff', 
                primaryFontColor: '#000000', 
                secondaryFontColor: '#9ca3af',
                btnBgColor: '#000000', 
                btnTextColor: '#ffffff' 
              } 
            })}
            className="no-theme bg-black text-white border-[3px] border-black px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20"
            style={{ backgroundColor: '#000000', color: '#ffffff', borderColor: '#000000', borderWidth: '3px' }}
          >
            إعادة ضبط الألوان الافتراضية
          </button>
        </div>
      </div>

      {activeSubTab === 'staff' && (
        <motion.div
          key="staff-tab"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-12"
        >
          <section className="space-y-6">
            <header className="border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold font-serif">إدارة طاقم الإدارة المعتمد</h3>
              <p className="text-sm text-gray-400 mt-1">يُسمح فقط للعناوين المدرجة هنا بالوصول إلى لوحة التحكم.</p>
            </header>

            <div className="flex gap-2">
              <input
                type="email"
                placeholder="إيميل المشرف الجديد..."
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl font-sans outline-none focus:ring-2 focus:ring-black"
              />
              <button onClick={handleAddAdmin} className="bg-black text-white px-6 rounded-xl hover:shadow-lg transition-all">
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">المدراء السياديون</h4>
              {MASTER_ADMINS.map(email => (
                <div key={email} className="p-4 bg-black text-white rounded-2xl flex items-center justify-between shadow-lg shadow-black/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Globe size={16} /></div>
                    <span className="font-sans font-bold text-sm">{email}</span>
                  </div>
                  <span className="text-[8px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">Owner</span>
                </div>
              ))}

              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mt-8">المدراء المعتمدون</h4>
              {(data?.admins || []).filter((e: string) => !MASTER_ADMINS.includes(e)).length === 0 && (
                <div className="p-8 text-center text-gray-300 font-serif italic border-2 border-dashed border-gray-100 rounded-3xl">
                  لا يوجد مدراء إضافيون مسجلون حالياً
                </div>
              )}
              {(data?.admins || []).filter((e: string) => !MASTER_ADMINS.includes(e)).map((email: string) => (
                <div key={email} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:border-gray-200 transition-all">
                  <span className="font-sans text-sm text-gray-600">{email}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('admins', email);
                    }} 
                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                    title="حذف المدير"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </motion.div>
      )}

      {activeSubTab === 'settings' && (
        <motion.div
          key="settings-tab"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-12"
        >
          <section className="bg-gray-50 p-8 rounded-3xl border border-gray-100 space-y-8">
            <header className="border-b border-gray-100 pb-6">
              <div className="flex items-center gap-3">
                <Settings size={24} className="text-black" />
                <h3 className="text-2xl font-bold font-serif">إعدادات المظهر السيادي</h3>
              </div>
              <p className="text-sm text-gray-400 mt-2">تخصيص الهوية البصرية للأرشيف وربطها بالهوية السيادية.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans px-2">عنوان الموقع الرئيسي</label>
                  <input
                    type="text"
                    value={data?.siteConfig?.siteTitle || ''}
                    onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), siteTitle: e.target.value } })}
                    className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-black font-serif text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans px-2">وصف الأرشيف</label>
                  <input
                    type="text"
                    value={data?.siteConfig?.siteDescription || ''}
                    onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), siteDescription: e.target.value } })}
                    className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-black font-serif"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans px-2">صورة الواجهة الرئيسية (HERO)</label>
                  <div className="flex flex-col lg:flex-row gap-6 p-6 bg-white border border-gray-200 rounded-3xl items-center">
                    <div className="w-32 h-32 rounded-2xl border-4 border-gray-100 overflow-hidden shrink-0 shadow-inner group relative bg-gray-50 flex items-center justify-center">
                      <img
                        src={mainHeaderFile ? URL.createObjectURL(mainHeaderFile) : (data?.siteConfig?.mainHeaderImage || 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=2282')}
                        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
                        alt="Preview"
                        referrerPolicy="no-referrer"
                      />
                      {mainHeaderFile && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-bold">صورة جديدة مختارة</div>}
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="file" 
                          id="hero-upload"
                          accept="image/*,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => setMainHeaderFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label 
                          htmlFor="hero-upload"
                          className="flex-1 flex items-center justify-center gap-3 bg-gray-50 border-2 border-dashed border-gray-200 py-4 rounded-2xl cursor-pointer hover:border-black hover:bg-white transition-all text-sm font-bold text-gray-500 hover:text-black"
                        >
                          <ImageIcon size={20} />
                          {mainHeaderFile ? 'تغيير الصورة المختارة' : 'إختيار صورة من الجهاز'}
                        </label>
                        
                        {mainHeaderFile && (
                          <button 
                            onClick={() => setMainHeaderFile(null)}
                            className="bg-red-50 text-red-500 p-4 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                            title="إلغاء الاختيار"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 text-center font-serif italic">يفضل استخدام صور عرضية (16:9) وبجودة عالية</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6 bg-white border border-gray-200 rounded-3xl mt-6">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans px-2">معاينة الرابط (Link Preview Customizer) 🕵️‍♂️</label>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-gray-500 font-sans px-2">عنوان سيادي (يظهر عند مشاركة رابط المقال)</label>
                       <input
                         type="text"
                         placeholder="مثال: أرشيف بيج بوس | {{title}}"
                         value={data?.siteConfig?.ogTitleFormat || ''}
                         onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), ogTitleFormat: e.target.value } })}
                         className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-black font-serif text-sm"
                       />
                       <p className="text-[10px] text-gray-400 px-2">استخدم <code>{`{{title}}`}</code> ليتم استبدالها باسم المقال.</p>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-bold text-gray-500 font-sans px-2">الصورة الافتراضية للموقع (رابط الصورة)</label>
                       
                       <div className="flex items-center gap-3">
                         <div className="w-16 h-16 rounded overflow-hidden shrink-0 shadow-inner bg-gray-50 flex items-center justify-center border border-gray-200">
                           <img
                             src={ogDefaultImageFile ? URL.createObjectURL(ogDefaultImageFile) : (data?.siteConfig?.ogDefaultImage || 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=2282')}
                             className="w-full h-full object-cover"
                             alt="Preview"
                           />
                         </div>
                         <div className="flex-1 flex gap-2">
                           <input
                             type="text"
                             placeholder="https://..."
                             value={data?.siteConfig?.ogDefaultImage || ''}
                             onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), ogDefaultImage: e.target.value } })}
                             className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-black font-serif text-sm"
                           />
                           <input 
                             type="file" 
                             id="ogDefault-upload"
                             accept="image/*,.jpg,.jpeg,.png,.webp"
                             onChange={(e) => setOgDefaultImageFile(e.target.files?.[0] || null)}
                             className="hidden"
                           />
                           <label 
                             htmlFor="ogDefault-upload"
                             className="bg-gray-100 hover:bg-gray-200 border border-gray-200 px-4 py-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center"
                             title="رفع صورة من الجهاز"
                           >
                              <ImageIcon size={20} className="text-gray-500"/>
                           </label>
                           {ogDefaultImageFile && (
                             <button 
                               onClick={() => setOgDefaultImageFile(null)}
                               className="bg-red-50 text-red-500 px-4 py-3 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
                               title="إلغاء الاختيار"
                             >
                               <Trash2 size={20} />
                             </button>
                           )}
                         </div>
                       </div>
                       <p className="text-[10px] text-gray-400 px-2">تظهر هذه الصورة كمعاينة في حال لم يكن للمقال صورة خاصة.</p>
                    </div>
                  </div>
                </div>

                {/* --- External Links Section Moved Out for Better Layout --- */}
                <div className="space-y-4 p-6 bg-white border border-gray-200 rounded-3xl">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans px-2">الروابط الخارجية (External Links)</label>
                  <div className="space-y-3">
                    {(data?.siteConfig?.externalLinks || []).map((link: any, idx: number) => (
                      <div key={link.id || idx} className="flex flex-col sm:flex-row gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <input 
                          type="text" 
                          placeholder="اسم الرابط"
                          value={link.title}
                          onChange={(e) => {
                            const newList = [...(data?.siteConfig?.externalLinks || [])];
                            newList[idx].title = e.target.value;
                            setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), externalLinks: newList } });
                          }}
                          className="w-full sm:w-1/3 bg-white px-4 py-2 rounded-xl text-xs font-bold"
                        />
                        <input 
                          type="text" 
                          placeholder="URL"
                          value={link.url}
                          onChange={(e) => {
                            const newList = [...(data?.siteConfig?.externalLinks || [])];
                            newList[idx].url = e.target.value;
                            setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), externalLinks: newList } });
                          }}
                          className="flex-1 w-full bg-white px-4 py-2 rounded-xl text-xs font-mono"
                        />
                        <button 
                          onClick={() => {
                            const newList = (data?.siteConfig?.externalLinks || []).filter((_: any, i: number) => i !== idx);
                            setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), externalLinks: newList } });
                          }}
                          className="text-red-500 p-2 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const newList = [...(data?.siteConfig?.externalLinks || []), { id: Date.now().toString(), title: '', url: '' }];
                        setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), externalLinks: newList } });
                      }}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs text-gray-400 hover:border-black hover:text-black transition-all flex items-center justify-center gap-2 font-bold"
                    >
                      <Plus size={16} /> إضافة رابط خارجي جديد
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-2 mb-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">The Sovereign Palette (الألوان)</h4>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                    <span className="font-serif text-sm">لون خلفية الموقع</span>
                    <input
                      type="color"
                      value={data?.siteConfig?.siteBgColor || '#ffffff'}
                      onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), siteBgColor: e.target.value } })}
                      className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                    <span className="font-serif text-sm">لون الخط الرئيسي (العناوين)</span>
                    <input
                      type="color"
                      value={data?.siteConfig?.primaryFontColor || '#000000'}
                      onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), primaryFontColor: e.target.value } })}
                      className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                    <span className="font-serif text-sm">لون الخط الثانوي (مشاركة، وثيقة...)</span>
                    <input
                      type="color"
                      value={data?.siteConfig?.secondaryFontColor || '#9ca3af'}
                      onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), secondaryFontColor: e.target.value } })}
                      className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                    <span className="font-serif text-sm">لون خلفية الأزرار</span>
                    <input
                      type="color"
                      value={data?.siteConfig?.btnBgColor || '#000000'}
                      onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), btnBgColor: e.target.value } })}
                      className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                    <span className="font-serif text-sm">لون نصوص الأزرار</span>
                    <input
                      type="color"
                      value={data?.siteConfig?.btnTextColor || '#ffffff'}
                      onChange={(e) => setData({ ...data, siteConfig: { ...(data?.siteConfig || {}), btnTextColor: e.target.value } })}
                      className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <button
                onClick={handleUpdateTheme}
                disabled={uploading || isSaving}
                className="w-full bg-black text-white py-5 rounded-2xl font-bold uppercase tracking-widest hover:shadow-2xl hover:shadow-black/20 transition-all flex items-center justify-center gap-3"
                style={{ backgroundColor: data?.siteConfig?.btnBgColor || '#000000', color: data?.siteConfig?.btnTextColor || '#ffffff' }}
              >
                {uploading || isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {uploading ? 'جاري رفع الأصول...' : 'تحديث إعدادات الهوية السيادية'}
              </button>
            </div>
          </section>
        </motion.div>
      )}

      {activeSubTab === 'monitor' && (
        <motion.div
           key="monitor-tab"
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="space-y-8"
        >
           {/* Dashboard Stats */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
             <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl transition-all hover:bg-gray-100">
               <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-4">
                 <FileText size={20} className="text-gray-800" />
               </div>
               <p className="text-sm text-gray-500 font-bold mb-1">الوثائق النشطة</p>
               <p className="text-3xl font-serif font-bold text-gray-900">{(data?.articles || []).filter((a: any) => !a.isDeleted).length}</p>
             </div>
             <div className="bg-red-50 border border-red-100 p-6 rounded-2xl transition-all hover:bg-red-100">
               <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-4">
                 <ArchiveRestore size={20} className="text-red-600" />
               </div>
               <p className="text-sm text-red-500 font-bold mb-1">الوثائق المحذوفة</p>
               <p className="text-3xl font-serif font-bold text-red-700">{(data?.articles || []).filter((a: any) => a.isDeleted).length}</p>
             </div>
             <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl transition-all hover:bg-gray-100">
               <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-4">
                 <LayoutList size={20} className="text-gray-800" />
               </div>
               <p className="text-sm text-gray-500 font-bold mb-1">التصنيفات</p>
               <p className="text-3xl font-serif font-bold text-gray-900">{(data?.categories || []).length}</p>
             </div>
             <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl transition-all hover:bg-gray-100">
               <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm mb-4">
                 <ShieldAlert size={20} className="text-gray-800" />
               </div>
               <p className="text-sm text-gray-500 font-bold mb-1">الإداريين</p>
               <p className="text-3xl font-serif font-bold text-gray-900">{(data?.admins || []).length}</p>
             </div>
           </div>

           {/* Deleted Articles Trash */}
           <div className="space-y-6">
              <header className="border-b border-gray-100 pb-4">
                 <h3 className="text-xl font-bold font-serif text-red-600">الأرشيف المحذوف (سلة المهملات)</h3>
                 <p className="text-sm text-gray-400 mt-1">المستندات التي تم حذفها، يمكنك التراجع أو الحذف النهائي من هنا.</p>
              </header>

              {(data?.articles || []).filter((a: any) => a.isDeleted).length === 0 ? (
                 <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-400 font-serif italic">
                    سلة المهملات فارغة حالياً.
                 </div>
              ) : (
                 <div className="space-y-4">
                    {(data?.articles || []).filter((a: any) => a.isDeleted).map((art: any) => (
                       <div key={art.id} className="p-6 bg-red-50/50 border border-red-100 rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                             <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                   <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-red-100 text-red-600">
                                      محذوف مؤقتاً
                                   </span>
                                   <span className="text-xs font-mono text-gray-500">تم الحذف: {new Date(art.deletedAt * 1000).toLocaleString('ar-EG')}</span>
                                </div>
                                <h4 className="text-sm font-bold font-sans text-gray-900">{art.title}</h4>
                             </div>
                             <div className="flex items-center gap-3">
                                <button 
                                   onClick={() => handleRestoreArticle?.(art.id)}
                                   className="text-xs font-bold text-green-600 hover:text-white transition-colors uppercase px-4 py-2 bg-green-50 hover:bg-green-600 rounded-xl"
                                >
                                   استعادة (الغاء التعديل)
                                </button>
                                <button 
                                   onClick={() => handlePermanentDeleteArticle?.(art.id)}
                                   className="text-xs font-bold text-red-600 hover:text-white transition-colors uppercase px-4 py-2 bg-red-50 hover:bg-red-600 rounded-xl"
                                >
                                   حذف نهائي
                                </button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              )}
           </div>

           <header className="border-b border-gray-100 pb-4 mt-12">
              <h3 className="text-xl font-bold font-serif">مراقب التعديلات السيادي (السجلات)</h3>
              <p className="text-sm text-gray-400 mt-1">تتبع وإدارة جميع الإجراءات التي يقوم بها طاقم الإدارة.</p>
           </header>

           {loadingLogs ? (
              <div className="p-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                 <Loader2 className="animate-spin w-8 h-8" />
                 <p className="font-serif italic">جاري جلب سجلات النشاط...</p>
              </div>
           ) : (!Array.isArray(logs) || logs.length === 0) ? (
              <div className="p-20 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-400 font-serif italic">
                 لا توجد سجلات نشاط مسجلة حالياً.
              </div>
           ) : (
              <div className="space-y-4">
                 {logs.map((log) => (
                    <div key={log.id} className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-black opacity-10 group-hover:opacity-100 transition-opacity" />
                       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex-1 space-y-1">
                             <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                   log.actionType.startsWith('DELETE') ? 'bg-red-100 text-red-600' : 
                                   log.actionType.startsWith('ADD') ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                   {log.actionType}
                                </span>
                                <span className="text-xs font-mono text-gray-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                             </div>
                             <h4 className="text-sm font-bold font-sans">{log.adminEmail}</h4>
                             <p className="text-xs text-gray-500 font-serif">
                                الإجراء: <span className="text-black font-bold">{log.targetId}</span>
                             </p>
                          </div>
                          <div className="flex items-center gap-3">
                             <button 
                                onClick={() => {
                                 try {
                                    const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2);
                                    alert("تفاصيل الإجراء: \n" + details);
                                 } catch(e) { alert("خطأ في قراءة التفاصيل"); }
                              }}
                                className="text-[10px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-widest px-3 py-1 bg-gray-50 rounded-lg"
                             >
                                التفاصيل JSON
                             </button>
                             <button 
                                onClick={() => handleDeleteLog?.(log.id)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                       </div>
                    </div>
                 ))}
                 <p className="text-[10px] text-gray-400 text-center italic mt-8">يتم حذف السجلات تلقائياً بعد مرور 30 يوماً من تاريخ الإجراء.</p>
              </div>
           )}
        </motion.div>
      )}
    </div>
  );
}
