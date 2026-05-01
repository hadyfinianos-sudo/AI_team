import { FilePlus, Plus, Trash2, Image as ImageIcon, Loader2, Upload, LayoutList, ExternalLink, Pencil, Search, Save, ChevronDown, Check, X, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';

interface ContentManagerProps {
  data: any;
  newArticle: { 
    id?: string; 
    title: string; 
    content: string; 
    pdfUrl: string; 
    videoUrl?: string; 
    headerImage: string; 
    imagePosition?: 'top' | 'center' | 'bottom'; 
    categoryId: string; 
    categoryIds?: string[] 
  };
  setNewArticle: (article: any) => void;
  newCategory: string;
  setNewCategory: (cat: string) => void;
  handleAddArticle: () => Promise<void>;
  handleAddCategory: () => Promise<void>;
  handleDelete: (type: 'categories' | 'articles', id: string) => Promise<void>;
  uploading: boolean;
  isSaving: boolean;
  setPdfFile: (file: File | null) => void;
  setHeaderImageFile: (file: File | null) => void;
  pdfFile: File | null;
  headerImageFile: File | null;
  isEditing: boolean;
  cancelEdit: () => void;
  handleUpdateCategory: (id: string, newTitle: string) => void;
}

export default function ContentManager({
  data,
  newArticle,
  setNewArticle,
  newCategory,
  setNewCategory,
  handleAddArticle,
  handleAddCategory,
  handleDelete,
  uploading,
  isSaving,
  setPdfFile,
  setHeaderImageFile,
  pdfFile,
  headerImageFile,
  isEditing,
  cancelEdit,
  handleUpdateCategory
}: ContentManagerProps) {
  const [useExternalPdf, setUseExternalPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatTitle, setEditCatTitle] = useState('');
  const [isCatListOpen, setIsCatListOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentCategoryIds = newArticle.categoryIds || (newArticle.categoryId ? [newArticle.categoryId] : []);

  return (
    <motion.div
      key="content-tab"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-12"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Add Article (Takes 2 columns) */}
        <section className="lg:col-span-2 space-y-6">
          <header className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold font-serif">
              {isEditing ? 'تعديل الوثيقة' : 'نشر وثيقة جديدة'}
            </h3>
            {isEditing && (
              <button 
                onClick={cancelEdit}
                className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg border border-red-100"
              >
                إلغاء التعديل
              </button>
            )}
          </header>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="عنوان المقال..."
              value={newArticle.title}
              onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
              className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-black outline-none font-serif"
            />

            <textarea
              placeholder="وصف مختصر للمستند..."
              value={newArticle.content}
              onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
              className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-black outline-none font-serif min-h-[120px]"
            />

            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 block">الأقسام (يمكن اختيار أكثر من قسم)</label>
              
              {/* Dropdown Trigger */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-black outline-none font-serif flex items-center justify-between text-right transition-all hover:bg-gray-100"
              >
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                  {currentCategoryIds.length > 0 ? (
                    currentCategoryIds.map(id => (
                      <span key={id} className="bg-black text-white text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 group/chip">
                        {(data?.categories || []).find((c: any) => c.id === id)?.title}
                        <X 
                          size={10} 
                          className="hover:text-red-400 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextIds = currentCategoryIds.filter(cid => cid !== id);
                            setNewArticle({ ...newArticle, categoryIds: nextIds, categoryId: nextIds[0] || '' });
                          }}
                        />
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm italic">اختر الأقسام المناسبة...</span>
                  )}
                </div>
                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar"
                  >
                    {(data?.categories || []).length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400 col-span-2">لا توجد أقسام مضافة بعد</div>
                    )}
                    {(data?.categories || []).map((cat: any) => {
                      const isSelected = currentCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            let nextIds;
                            if (isSelected) {
                              nextIds = currentCategoryIds.filter(id => id !== cat.id);
                            } else {
                              nextIds = [...currentCategoryIds, cat.id];
                            }
                            setNewArticle({ 
                              ...newArticle, 
                              categoryIds: nextIds,
                              categoryId: nextIds[0] || '' 
                            });
                          }}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-serif transition-colors text-right ${isSelected ? 'bg-black text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                        >
                          <span className="truncate">{cat.title}</span>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-6 bg-gray-50/30 p-4 rounded-3xl border border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">مصدر ملف الـ PDF</label>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setUseExternalPdf(false);
                      setNewArticle({ ...newArticle, pdfUrl: '' });
                    }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-[11px] font-bold ${!useExternalPdf ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                  >
                    <Upload size={16} />
                    رفع من الجهاز
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setUseExternalPdf(true);
                      setPdfFile(null);
                    }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all text-[11px] font-bold ${useExternalPdf ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                  >
                    <ExternalLink size={16} />
                    رابط Google Drive
                  </button>
                </div>

                <div className="mt-2">
                  {useExternalPdf ? (
                    <div className="flex items-center gap-3 bg-white border-2 border-gray-100 py-4 px-6 rounded-2xl transition-all group focus-within:border-black shadow-sm">
                      <div className="p-2 bg-blue-50 text-blue-500 rounded-lg group-focus-within:bg-blue-100 transition-colors">
                        <ExternalLink size={16} />
                      </div>
                      <input 
                        type="text"
                        placeholder="إلصق رابط المستند هنا..."
                        value={newArticle.pdfUrl}
                        onChange={(e) => setNewArticle({ ...newArticle, pdfUrl: e.target.value })}
                        className="w-full bg-transparent border-none outline-none font-serif text-sm placeholder:text-gray-300"
                      />
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border-2 border-gray-100 py-4 rounded-2xl cursor-pointer transition-all text-xs font-bold text-gray-500 hover:border-gray-200">
                      <div className="p-2 bg-gray-100 group-hover:bg-gray-200 rounded-lg transition-colors">
                        <Upload size={18} className="text-gray-600" />
                      </div>
                      <span className="truncate max-w-[200px] font-serif">{pdfFile ? pdfFile.name : (isEditing && newArticle.pdfUrl && !newArticle.pdfUrl.startsWith('http')) ? 'تم رفع ملف مسبقاً' : 'إختيار ملف PDF من الجهاز'}</span>
                      <input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Video URL Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">فيديو يوتيوب (اختياري)</label>
                </div>
                <div className="flex items-center gap-3 bg-white border-2 border-gray-100 py-4 px-6 rounded-2xl transition-all group focus-within:border-black shadow-sm">
                  <div className="p-2 bg-red-50 text-red-500 rounded-lg group-focus-within:bg-red-100 transition-colors">
                    <Video size={16} />
                  </div>
                  <input 
                    type="url"
                    placeholder="إلصق رابط يوتيوب هنا..."
                    value={newArticle.videoUrl || ''}
                    onChange={(e) => setNewArticle({ ...newArticle, videoUrl: e.target.value })}
                    className="w-full bg-transparent border-none outline-none font-serif text-sm placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 block">صورة الغلاف (إختياري)</label>
                <label className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border-2 border-gray-100 py-4 rounded-2xl cursor-pointer transition-all text-xs font-bold text-gray-500 hover:border-black group shadow-sm">
                  <div className="p-2 bg-gray-100 group-hover:bg-gray-200 rounded-lg transition-colors">
                    <ImageIcon size={18} className="text-gray-600" />
                  </div>
                  <span className="truncate max-w-[200px] font-serif">{headerImageFile ? headerImageFile.name : (isEditing && newArticle.headerImage) ? 'تم رفع صورة مسبقاً' : 'إختيار صورة غلاف من الجهاز'}</span>
                  <input
                    id="header-image-upload"
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setHeaderImageFile(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                  />
                </label>

                {/* Image Position Selector */}
                {(headerImageFile || (isEditing && newArticle.headerImage)) && (
                  <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 block">محاذاة الصورة</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'top', label: 'أعلى' },
                        { id: 'center', label: 'وسط' },
                        { id: 'bottom', label: 'أسفل' }
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => setNewArticle({ ...newArticle, imagePosition: pos.id })}
                          className={`py-2 px-4 rounded-xl border transition-all text-xs font-bold ${newArticle.imagePosition === pos.id || (!newArticle.imagePosition && pos.id === 'center') ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleAddArticle}
              disabled={uploading || isSaving}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 hover:shadow-xl hover:shadow-black/10 transition-all disabled:bg-gray-400 relative overflow-hidden"
            >
              <div className="flex items-center gap-3">
                {uploading || isSaving ? <Loader2 className="animate-spin" size={20} /> : <FilePlus size={20} />}
                {uploading ? 'جاري رفع الملفات...' : isSaving ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'نشر الوثيقة الآن'}
              </div>
              {uploading && (
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000 w-[70%]" />
              )}
            </button>
          </div>
        </section>

        {/* Categories (Mobile Dropdown) */}
        <section className="space-y-6">
          <header className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold font-serif">تصنيفات المشروع</h3>
            <button 
              onClick={() => setIsCatListOpen(!isCatListOpen)}
              className="md:hidden text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-2"
            >
              {isCatListOpen ? 'إخفاء' : `إظهار القائمة (${(data?.categories || []).length})`}
              <LayoutList size={14} />
            </button>
          </header>

          <div className="flex flex-col gap-2">
            <button 
              onClick={handleAddCategory} 
              className="bg-black text-white py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 w-full"
            >
              <Plus size={20} />
              <span className="font-serif text-sm">إضافة قسم جديد</span>
            </button>
            <input
              type="text"
              placeholder="اكتب اسم القسم الجديد هنا..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-sm font-serif outline-none focus:ring-2 focus:ring-black text-center"
            />
          </div>

          <div className={`grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar ${!isCatListOpen ? 'hidden md:grid' : 'grid'}`}>
            {(data?.categories || []).map((cat: any) => (
              <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl group hover:border-black/5 transition-all shadow-sm">
                {editingCatId === cat.id ? (
                  <div className="flex-1 flex gap-2">
                    <input 
                      autoFocus
                      type="text"
                      value={editCatTitle}
                      onChange={(e) => setEditCatTitle(e.target.value)}
                      className="flex-1 border-b-2 border-black outline-none font-serif text-sm px-1 bg-transparent text-right"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateCategory(cat.id, editCatTitle);
                          setEditingCatId(null);
                        }
                        if (e.key === 'Escape') setEditingCatId(null);
                      }}
                    />
                    <button 
                      onClick={() => {
                        handleUpdateCategory(cat.id, editCatTitle);
                        setEditingCatId(null);
                      }}
                      className="text-green-500 p-1 hover:bg-green-50 rounded"
                    >
                      <Save size={16} />
                    </button>
                  </div>
                ) : (
                  <span className="font-serif text-sm font-bold truncate max-w-[150px]">{cat.title}</span>
                )}
                
                <div className="flex gap-1 shrink-0">
                  {editingCatId !== cat.id && (
                    <button 
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setEditCatTitle(cat.title);
                      }}
                      className="text-gray-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-all"
                      title="تعديل اسم القسم"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('categories', cat.id);
                    }} 
                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                    title="حذف التصنيف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Archive List Full Width */}
      <section className="space-y-6">
        <header className="flex flex-col md:flex-row items-center justify-between border-b border-gray-100 pb-4 gap-4">
          <h3 className="text-xl font-bold font-serif whitespace-nowrap">الأرشيف الحالي ({(data?.articles || []).filter((a: any) => !a.isDeleted).length} وثيقة)</h3>
          
          <div className="relative w-full max-w-md">
            <input 
              type="text"
              placeholder="ابحث عن وثيقة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 px-4 py-2 pr-10 rounded-xl text-sm font-serif outline-none focus:ring-2 focus:ring-black"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={18} />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {(data?.articles || [])
              .filter((a: any) => !a.isDeleted && (a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content?.toLowerCase().includes(searchQuery.toLowerCase())))
              .map((art: any) => (
              <motion.div
                key={art.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col bg-white border border-gray-100 rounded-2xl group hover:border-black/10 transition-all shadow-sm relative overflow-hidden"
              >
                <div className="h-40 bg-gray-50 relative overflow-hidden shrink-0">
                  {art.headerImage ? (
                    <img
                      src={art.headerImage}
                      style={{ objectPosition: art.imagePosition || 'center' }}
                      className="w-full h-full object-cover transition-all duration-700 lg:grayscale lg:group-hover:grayscale-0"
                      alt={art.title}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200"><ImageIcon size={32} /></div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewArticle(art);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-2 bg-white text-blue-500 rounded-lg shadow-md hover:bg-blue-50 transition-all border border-blue-100"
                      title="تعديل الوثيقة"
                    >
                      <Pencil size={14} /> 
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('articles', art.id);
                      }}
                      className="p-2 bg-white text-red-500 rounded-lg shadow-md hover:bg-red-50 transition-all border border-red-100"
                      title="نقل للأرشيف المحذوف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setNewArticle(art);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-4 flex-1 text-right hover:bg-gray-50 transition-colors"
                >
                  <h5 className="font-bold text-gray-900 font-serif line-clamp-1">{art.title}</h5>
                  <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest">
                    {(data?.categories || []).find((c: any) => c.id === art.categoryId)?.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-2 line-clamp-2 font-serif">{art.content}</p>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </motion.div>
  );
}
