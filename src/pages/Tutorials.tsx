import React, { useState, useEffect } from "react";
import {
  Play,
  Youtube,
  Loader2,
  ExternalLink,
  ArrowLeft,
  Users,
  CalendarCheck,
  CreditCard,
  BookOpen,
  MoreHorizontal,
  PhoneCall,
  Search,
  X
} from "lucide-react";
import { supabase } from "supabase";
import { Language, Tutorial, Institution } from "types";

interface TutorialsProps {
  lang: Language;
  onBack: () => void;
  madrasah: Institution | null;
}

const Tutorials: React.FC<TutorialsProps> = ({ lang, onBack, madrasah }) => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isDark = madrasah?.theme === "dark";

  const categories = React.useMemo(() => [
    { id: 'attendance', bn: 'হাজিরা', en: 'Attendance', icon: CalendarCheck, color: 'text-emerald-500' },
    { id: 'student', bn: 'শিক্ষার্থী', en: 'Students', icon: Users, color: 'text-blue-500' },
    { id: 'accounting', bn: 'হিসাব', en: 'Accounting', icon: CreditCard, color: 'text-amber-500' },
    { id: 'exam', bn: 'পরীক্ষা', en: 'Exams', icon: BookOpen, color: 'text-indigo-500' },
    { id: 'sms_voice', bn: 'এসএমএস ও ভয়েস কল', en: 'SMS & Voice Call', icon: PhoneCall, color: 'text-rose-500' },
    { id: 'other', bn: 'অন্যান্য', en: 'Others', icon: MoreHorizontal, color: 'text-slate-500' }
  ], []);

  const getCategoryMeta = React.useCallback(
    (categoryId?: string) => {
      if (!categoryId) return categories.find(c => c.id === 'other');
      return categories.find(c => c.id === categoryId) || categories.find(c => c.id === 'other');
    },
    [categories]
  );

  useEffect(() => {
    let isMounted = true;
    const loadTutorials = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("tutorials")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (isMounted) setTutorials(data || []);
      } catch (err) {
        console.error("Error fetching tutorials:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTutorials();
    return () => { isMounted = false; };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const matchesSearch = React.useCallback(
    (tutorial: Tutorial) => {
      if (!normalizedQuery) return true;
      const catMeta = getCategoryMeta(tutorial.category);
      const haystack = [
        tutorial.title || "",
        (tutorial as any).description || "",
        tutorial.category || "",
        catMeta?.bn || "",
        catMeta?.en || ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    },
    [normalizedQuery, getCategoryMeta]
  );

  const filteredTutorials = React.useMemo(() => {
    if (!selectedCategory) {
      if (!isSearching) return [];
      return tutorials.filter(matchesSearch);
    }

    return tutorials.filter(t => {
      const inCategory = selectedCategory === 'other'
        ? (t.category === 'other' || !t.category)
        : t.category === selectedCategory;
      if (!inCategory) return false;
      return matchesSearch(t);
    });
  }, [tutorials, selectedCategory, isSearching, matchesSearch]);

  const selectedCategoryData = React.useMemo(() =>
    categories.find(c => c.id === selectedCategory),
    [selectedCategory, categories]
  );

  const getCategoryCount = (catId: string) => {
    if (catId === 'other') {
      return tutorials.filter(t => t.category === 'other' || !t.category).length;
    }
    return tutorials.filter(t => t.category === catId).length;
  };

  return (
    <div
      className={`min-h-screen pb-24 ${isDark ? "bg-slate-900" : ""}`}
    >
      <div
        className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-transparent border-blue-100"} px-4 py-4 flex items-center gap-4 border-b`}
      >
        <button
          onClick={selectedCategory ? () => setSelectedCategory(null) : onBack}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? "bg-slate-800 text-blue-400 border-slate-700" : "bg-blue-50 text-[#2563EB] border-blue-100"}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1
            className={`text-lg font-black font-noto truncate ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
          >
            {selectedCategory
              ? (lang === 'bn' ? (selectedCategoryData?.bn || selectedCategory) : (selectedCategoryData?.en || selectedCategory))
              : (lang === "bn" ? "টিউটোরিয়াল" : "Tutorials")}
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {selectedCategory
              ? (lang === 'bn' ? 'ভিডিও টিউটোরিয়াল লিস্ট' : 'Video Tutorial List')
              : (lang === "bn" ? "এপ চালনোর ভিডিও গাইড" : "App Usage Video Guides")}
          </p>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Global / Category Video Search Bar */}
        <div className="relative">
          <Search
            size={18}
            className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-400" : "text-slate-400"}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              selectedCategory
                ? (lang === "bn"
                    ? `${selectedCategoryData?.bn || ""} ক্যাটাগরিতে ভিডিও খুঁজুন...`
                    : `Search videos in ${selectedCategoryData?.en || selectedCategory}...`)
                : (lang === "bn"
                    ? "যেকোনো ভিডিও টিউটোরিয়াল খুঁজুন (যেমন: হাজিরা, বেতন, SMS)..."
                    : "Search all video tutorials (e.g. Attendance, Fees, SMS)...")
            }
            className={`w-full h-12 pl-11 pr-11 rounded-2xl border font-noto text-sm font-bold outline-none transition-all shadow-sm ${
              isDark
                ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
                : "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#2563EB]"
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={lang === "bn" ? "সার্চ মুছুন" : "Clear search"}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="text-sm font-bold">
              {lang === "bn" ? "লোড হচ্ছে..." : "Loading..."}
            </p>
          </div>
        ) : !selectedCategory && !isSearching ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-bubble flex flex-col items-center justify-center gap-2 md:gap-4 active:scale-95 transition-all group hover:border-blue-300`}
              >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  <cat.icon size={24} className={cat.color} />
                </div>
                <div className="text-center">
                  <h3 className={`text-xs md:text-sm font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? cat.bn : cat.en}
                  </h3>
                  <p className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {getCategoryCount(cat.id)} {lang === 'bn' ? 'টি ভিডিও' : 'Videos'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : filteredTutorials.length === 0 ? (
          <div
            className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"} rounded-[2.5rem] p-10 text-center border shadow-bubble`}
          >
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-slate-700 text-slate-500" : "bg-slate-50 text-slate-300"}`}
            >
              {isSearching ? <Search size={30} /> : <Youtube size={32} />}
            </div>
            <p className="text-slate-400 font-bold font-noto">
              {isSearching
                ? (lang === "bn"
                    ? `"${searchQuery}" এর জন্য কোনো ভিডিও টিউটোরিয়াল পাওয়া যায়নি`
                    : `No tutorials found matching "${searchQuery}"`)
                : (lang === "bn"
                    ? "এই ক্যাটাগরিতে কোন ভিডিও পাওয়া যায়নি"
                    : "No tutorials found in this category")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {isSearching && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-blue-50 text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-400 hover:opacity-90 transition-opacity"
                >
                  {lang === 'bn' ? 'সার্চ মুছুন' : 'Clear Search'}
                </button>
              )}
              {isSearching && selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 hover:opacity-90 transition-opacity"
                >
                  {lang === 'bn' ? 'সকল ক্যাটাগরিতে খুঁজুন' : 'Search All Categories'}
                </button>
              )}
              {!isSearching && selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-sm font-black text-blue-500 uppercase tracking-widest hover:underline"
                >
                  {lang === 'bn' ? 'পেছনে যান' : 'Go Back'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isSearching && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-noto">
                  {lang === "bn"
                    ? `মোট ${filteredTutorials.length}টি ভিডিও পাওয়া গেছে`
                    : `Found ${filteredTutorials.length} matching tutorial${filteredTutorials.length === 1 ? "" : "s"}`}
                </p>
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs font-black text-[#2563EB] dark:text-blue-400 hover:underline font-noto"
                  >
                    {lang === "bn" ? "সকল ক্যাটাগরিতে দেখুন" : "Search all categories"}
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-4">
              {filteredTutorials.map((tutorial) => {
                const catMeta = getCategoryMeta(tutorial.category);
                return (
                  <a
                    key={tutorial.id}
                    href={tutorial.url || (tutorial as any).youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"} p-5 rounded-[2rem] border shadow-bubble flex items-center gap-4 sm:gap-5 active:scale-[0.98] transition-all group`}
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-red-50 text-red-500 dark:bg-red-500/15 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Play size={22} fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-sm font-black font-noto leading-snug mb-1.5 ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
                      >
                        {tutorial.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Youtube size={12} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            YouTube
                          </span>
                        </span>
                        {!selectedCategory && catMeta && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-noto ${
                              isDark
                                ? "bg-slate-700 text-slate-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {lang === "bn" ? catMeta.bn : catMeta.en}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${isDark ? "bg-slate-700 text-slate-400 group-hover:bg-blue-900/30 group-hover:text-blue-400" : "bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#2563EB]"}`}
                    >
                      <ExternalLink size={16} />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tutorials;
