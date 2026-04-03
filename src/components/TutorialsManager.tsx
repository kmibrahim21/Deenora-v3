import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Loader2, Play, Trash2, X, CheckCircle2 } from 'lucide-react';
import { supabase } from 'supabase';

interface TutorialsManagerProps {
  onBack: () => void;
  madrasah: any;
  setStatusModal: (modal: any) => void;
}

export const TutorialsManager: React.FC<TutorialsManagerProps> = ({ onBack, madrasah, setStatusModal }) => {
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [tutorialToDelete, setTutorialToDelete] = useState<string | null>(null);

  const fetchTutorials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setTutorials(data || []);
    } catch (error) {
      console.error('Error fetching tutorials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutorials();
  }, []);

  const handleAddTutorial = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('tutorials').insert({
        title: newTitle.trim(),
        url: newUrl.trim()
      });
      if (error) {
        if (error.message.includes('schema cache')) {
          throw new Error('Database table "tutorials" not found. Please contact support to create the table.');
        }
        throw error;
      }
      setShowAddModal(false);
      setNewTitle('');
      setNewUrl('');
      fetchTutorials();
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'টিউটোরিয়াল যুক্ত হয়েছে।' });
    } catch (error: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTutorial = async () => {
    if (!tutorialToDelete) return;
    try {
      const { error } = await supabase.from('tutorials').delete().eq('id', tutorialToDelete);
      if (error) throw error;
      fetchTutorials();
      setTutorialToDelete(null);
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'টিউটোরিয়াল মুছে ফেলা হয়েছে।' });
    } catch (error: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: error.message });
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>Tutorials Management</h1>
        </div>
        <button onClick={() => setShowAddModal(true)} className="p-2 bg-blue-50 rounded-xl text-[#2563EB] active:scale-95 transition-all border border-blue-100 shadow-sm flex items-center gap-2 px-4">
           <Plus size={18} /> <span className="text-xs font-black">Add New</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest">Loading Tutorials...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {tutorials.length > 0 ? tutorials.map(t => (
            <div key={t.id} className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble flex items-center justify-between`}>
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                  <Play size={20} fill="currentColor" />
                </div>
                <div className="min-w-0">
                  <h4 className={`font-black truncate ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 truncate">{t.url}</p>
                </div>
              </div>
              <button 
                onClick={() => setTutorialToDelete(t.id)}
                className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )) : (
            <div className={`text-center py-16 rounded-[3rem] border-2 border-dashed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play size={32} />
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No Tutorials Found</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {tutorialToDelete && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-[2rem] shadow-2xl border overflow-hidden p-6 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
            <h3 className={`text-xl font-black mb-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Delete Tutorial
            </h3>
            <p className={`text-sm mb-6 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Are you sure you want to delete this tutorial? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTutorialToDelete(null)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTutorial}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-white/50'} rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border animate-in zoom-in-95 duration-200`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>Add New Tutorial</h2>
              <button onClick={() => setShowAddModal(false)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Tutorial Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. How to add students"
                  className={`w-full px-6 py-4 rounded-2xl border transition-all focus:ring-4 focus:ring-blue-500/10 outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-[#1E293B] placeholder:text-slate-300'}`}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">YouTube URL</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={`w-full px-6 py-4 rounded-2xl border transition-all focus:ring-4 focus:ring-blue-500/10 outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-[#1E293B] placeholder:text-slate-300'}`}
                />
              </div>
              <button
                onClick={handleAddTutorial}
                disabled={saving || !newTitle.trim() || !newUrl.trim()}
                className="w-full h-12 bg-[#2563EB] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {saving ? 'Saving...' : 'Add Tutorial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
