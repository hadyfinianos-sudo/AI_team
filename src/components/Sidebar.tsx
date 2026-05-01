import { ChevronDown, ChevronLeft, FileText, LayoutIcon } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Article } from '../types';

interface SidebarProps {
  categories: Category[];
  selectedArticleId?: string;
  onSelectArticle: (article: Article) => void;
}

export default function Sidebar({ categories, selectedArticleId, onSelectArticle }: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map(c => [c.id, true]))
  );

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="w-72 bg-[#fbfbfb] border-l border-gray-200 h-full md:h-full md:sticky md:top-0 overflow-y-auto">
      <div className="p-8 flex flex-col gap-8">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-tighter mb-6 border-b border-gray-100 pb-2 font-sans">
            الفهرس العام للمواد
          </h3>

          <nav className="space-y-8">
            {categories.map((category) => (
              <div key={category.id} className="space-y-4">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center justify-between w-full text-right font-bold text-gray-700 hover:text-black transition-colors py-1 group font-serif text-lg"
                >
                  <span>{category.title}</span>
                  <div className="opacity-40 group-hover:opacity-100 transition-opacity">
                    {expandedCategories[category.id] ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronLeft size={14} />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {expandedCategories[category.id] && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-r border-gray-100 mr-1 pr-4 space-y-3"
                    >
                      {category.articles.map((article) => (
                        <li key={article.id}>
                          <button
                            onClick={() => onSelectArticle(article)}
                            className={`group flex items-start gap-2 w-full text-right transition-all text-sm font-serif ${
                              selectedArticleId === article.id
                                ? "text-black font-bold"
                                : "text-gray-500 hover:text-black"
                            }`}
                          >
                            <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${
                              selectedArticleId === article.id ? "bg-black" : "bg-gray-300"
                            }`} />
                            <span className="leading-relaxed">{article.title}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
