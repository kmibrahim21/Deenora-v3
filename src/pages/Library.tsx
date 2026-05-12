import React, { useState, useEffect, useMemo } from 'react';
import { BookMarked, BookType, BookOpenCheck, Settings2, Trash2, Edit, Plus, Search, ShieldAlert, ArrowLeft, Filter, CalendarDays, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { t } from '../translations';
import { Language, Institution, Profile } from '../types';

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  category: string;
  class_id?: string;
  quantity: number;
  available_quantity: number;
  rack_number: string;
  description: string;
  cover_url: string;
}

interface LibraryIssue {
  id: string;
  book_id: string;
  user_type: 'student' | 'teacher';
  student_id?: string;
  teacher_id?: string;
  issue_date: string;
  due_date: string;
  return_date?: string;
  status: 'issued' | 'returned' | 'lost';
  notes: string;
  book?: LibraryBook;
  student?: { student_name: string; roll: string };
  teacher?: { name: string };
}

interface LibraryProps {
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
}

export default function Library({ lang, madrasah, profile }: LibraryProps) {
  const isDark = madrasah?.theme === 'dark';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'books' | 'issues'>('dashboard');

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [issues, setIssues] = useState<LibraryIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showAddBook, setShowAddBook] = useState(false);
  const [editBook, setEditBook] = useState<LibraryBook | null>(null);

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueUserType, setIssueUserType] = useState<'student' | 'teacher'>('student');
  const [issueClassId, setIssueClassId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const [tableExists, setTableExists] = useState(true);
  const [dbError, setDbError] = useState<string>('');

  // Fetch Data
  const fetchData = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    setDbError('');
    try {
      const [booksRes, issuesRes] = await Promise.all([
        supabase.from('library_books').select('*').eq('institution_id', madrasah.id).order('created_at', { ascending: false }),
        supabase.from('library_issues').select(`
          *,
          book:library_books(title, author, rack_number),
          student:students(student_name, roll),
          teacher:teachers(name:teacher_name)
        `).eq('institution_id', madrasah.id).order('created_at', { ascending: false })
      ]);

      if (issuesRes.error) {
         console.error("Issues fetch error:", issuesRes.error);
         setDbError(JSON.stringify(issuesRes.error));
      } else if (issuesRes.data) {
          setIssues(issuesRes.data as any);
      }

      if (booksRes.error && booksRes.error.message.includes('does not exist')) {
         setTableExists(false);
         return;
      }

      if (booksRes.data) setBooks(booksRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!madrasah?.id) return;
    try {
      const [stRes, tcRes, clRes] = await Promise.all([
        supabase.from('students').select('id, student_name, roll, class_id').eq('institution_id', madrasah.id),
        supabase.from('teachers').select('id, name:teacher_name').eq('institution_id', madrasah.id).eq('is_active', true),
        supabase.from('classes').select('id, class_name').eq('institution_id', madrasah.id).order('sort_order', { ascending: true })
      ]);
      if (stRes.data) setStudents(stRes.data);
      if (tcRes.data) setTeachers(tcRes.data);
      if (clRes.data) setClasses(clRes.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [madrasah?.id]);

  const handleCreateBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!madrasah?.id) return;
    const form = e.currentTarget;
    const formData = new FormData(form);

    const newBook = {
      institution_id: madrasah.id,
      title: formData.get('title') as string,
      author: formData.get('author') as string,
      category: formData.get('category') as string,
      quantity: Number(formData.get('quantity')),
      available_quantity: Number(formData.get('quantity')), // Initially available = total
      rack_number: formData.get('rack_number') as string,
      description: formData.get('description') as string,
    };

    try {
      const { error } = await supabase.from('library_books').insert(newBook);
      if (error) throw error;
      fetchData();
      setShowAddBook(false);
    } catch (error: any) {
      alert("Error adding book: " + error.message);
    }
  };

  const handleUpdateBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editBook) return;
    const form = e.currentTarget;
    const formData = new FormData(form);

    const qty = Number(formData.get('quantity'));
    const oldQty = editBook.quantity;
    const diff = qty - oldQty;
    const newAvail = editBook.available_quantity + diff;

    const updates = {
      title: formData.get('title') as string,
      author: formData.get('author') as string,
      category: formData.get('category') as string,
      quantity: qty,
      available_quantity: newAvail < 0 ? 0 : newAvail,
      rack_number: formData.get('rack_number') as string,
      description: formData.get('description') as string,
    };

    try {
      const { error } = await supabase.from('library_books').update(updates).eq('id', editBook.id);
      if (error) throw error;
      fetchData();
      setEditBook(null);
    } catch (error: any) {
      alert("Error updating book: " + error.message);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!confirm(lang === 'bn' ? "বইটি মুছে ফেলতে চান?" : "Delete this book?")) return;
    try {
      const { error } = await supabase.from('library_books').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert("Error deleting book: " + error.message);
    }
  };

  const handleIssueBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!madrasah?.id) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const book_id = formData.get('book_id') as string;
    const user_type = formData.get('user_type') as 'student' | 'teacher';
    const active_user_id = formData.get('active_user_id') as string;

    const book = books.find(b => b.id === book_id);
    if (!book || book.available_quantity < 1) {
      alert(lang === 'bn' ? "বইটি বর্তমানে স্টকে নেই।" : "Book out of stock.");
      return;
    }

    const payload: any = {
      institution_id: madrasah.id,
      book_id,
      user_type,
      due_date: formData.get('due_date') as string,
      status: 'issued',
      notes: formData.get('notes') as string,
    };

    if (user_type === 'student') payload.student_id = active_user_id;
    if (user_type === 'teacher') payload.teacher_id = active_user_id;

    try {
      // Create issue
      const { error: issueErr } = await supabase.from('library_issues').insert(payload);
      if (issueErr) throw issueErr;

      // Update book qty
      const { error: bookErr } = await supabase.from('library_books')
        .update({ available_quantity: book.available_quantity - 1 })
        .eq('id', book_id);
      
      if (bookErr) throw bookErr;

      fetchData();
      setShowIssueModal(false);
    } catch (error: any) {
      alert("Error issuing book: " + error.message);
    }
  };

  const handleReturnBook = async (issue: LibraryIssue) => {
    if (!confirm(lang === 'bn' ? "বইটি ফেরত নেওয়া হয়েছে?" : "Mark as returned?")) return;
    try {
      const { error: issueErr } = await supabase.from('library_issues')
        .update({ status: 'returned', return_date: new Date().toISOString() })
        .eq('id', issue.id);
      if (issueErr) throw issueErr;

      // Ensure we have current book
      const book = books.find(b => b.id === issue.book_id);
      if (book) {
        await supabase.from('library_books')
          .update({ available_quantity: book.available_quantity + 1 })
          .eq('id', book.id);
      }

      fetchData();
    } catch (error: any) {
      alert("Error returning book: " + error.message);
    }
  };


  const stats = useMemo(() => {
    const totalBooks = books.reduce((acc, curr) => acc + curr.quantity, 0);
    const availableBooks = books.reduce((acc, curr) => acc + curr.available_quantity, 0);
    const issuedBooks = totalBooks - availableBooks;
    
    // Calculate overdue
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = issues.filter(i => i.status === 'issued' && i.due_date < today).length;

    return { totalBooks, availableBooks, issuedBooks, overdueCount };
  }, [books, issues]);

  const filteredBooks = books.filter(b => 
    (b.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (b.author?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (b.rack_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (b.category?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`animate-in slide-in-from-right-4 duration-700 pb-24 space-y-8 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {dbError && (
        <div className="bg-red-500 text-white p-4 rounded-xl text-xs font-mono font-bold break-words">{dbError}</div>
      )}
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] shadow-[0_20px_50px_-15px_rgba(37,99,235,0.3)] border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 animate-pulse">
           <BookType size={120} strokeWidth={1} />
        </div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5 md:gap-6">
            <div className={`w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-[1.5rem] flex items-center justify-center bg-white/20 backdrop-blur-2xl text-white shadow-xl border border-white/30`}>
              <BookType size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black font-noto tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">{lang === 'bn' ? 'লাইব্রেরী' : 'Library'}</h1>
              <p className="text-xs md:text-sm font-bold text-white/80 font-noto mt-1 md:mt-1.5 uppercase tracking-widest">
                {lang === 'bn' ? 'বই এবং ইস্যু ম্যানেজমেন্ট' : 'Manage books & issues'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <button onClick={() => { setShowIssueModal(true); setIssueUserType('student'); }} className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-sm border bg-white/10 text-white border-white/20 hover:bg-white/20">
               <BookOpenCheck size={16} /> {lang === 'bn' ? 'বই ইস্যু করুন' : 'Issue Book'}
             </button>
             <button onClick={() => setShowAddBook(true)} className="px-5 py-3 bg-white text-blue-700 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-premium">
               <Plus size={16} /> {lang === 'bn' ? 'নতুন বই' : 'Add Book'}
             </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-2 scrollbar-hide relative z-10">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Settings2 size={16} />} title={lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'} isDark={true} />
          <TabButton active={activeTab === 'books'} onClick={() => setActiveTab('books')} icon={<BookMarked size={16} />} title={lang === 'bn' ? 'বই তালিকা' : 'Books'} isDark={true} />
          <TabButton active={activeTab === 'issues'} onClick={() => setActiveTab('issues')} icon={<BookOpenCheck size={16} />} title={lang === 'bn' ? 'ইস্যু হিস্ট্রি' : 'Issues'} isDark={true} />
        </div>
      </div>

      {/* Content */}
      <div className="px-2 sm:px-4 md:px-6 relative">
        {!tableExists && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
             <div className="bg-white p-8 rounded-3xl max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 to-red-600"></div>
                <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-xl font-black text-slate-800 mb-2">Database Setup Required</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  The Library Management module tables have not been created yet. Please ask the super admin to run the migration script <code className="bg-slate-100 px-2 py-1 rounded text-red-500 font-mono text-xs">src/services/migration_library_module.sql</code> in the Supabase SQL Editor.
                </p>
             </div>
          </div>
        )}

        {loading ? (
           <div className="flex items-center justify-center h-40">
             <div className="animate-spin text-blue-500"><Settings2 size={32} /></div>
           </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                 {/* Stats */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title={lang === 'bn' ? 'মোট বই' : 'Total Books'} value={stats.totalBooks} icon={<BookMarked size={20} />} isDark={isDark} color="blue" />
                    <StatCard title={lang === 'bn' ? 'এভেইলেবল' : 'Available'} value={stats.availableBooks} icon={<CheckCircle2 size={20} />} isDark={isDark} color="emerald" />
                    <StatCard title={lang === 'bn' ? 'ইস্যুকৃত' : 'Issued'} value={stats.issuedBooks} icon={<BookOpenCheck size={20} />} isDark={isDark} color="indigo" />
                    <StatCard title={lang === 'bn' ? 'ওভারডিউ' : 'Overdue'} value={stats.overdueCount} icon={<ShieldAlert size={20} />} isDark={isDark} color="red" />
                 </div>

                 {/* Overdue Section */}
                 {stats.overdueCount > 0 && (
                   <div className={`p-5 rounded-[2rem] border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'} space-y-4`}>
                      <h3 className={`text-sm font-black flex items-center gap-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}><ShieldAlert size={18} /> Overdue Books</h3>
                      <div className="space-y-3">
                         {issues.filter(i => i.status === 'issued' && i.due_date < new Date().toISOString().split('T')[0]).map(issue => (
                           <div key={issue.id} className={`p-4 rounded-xl flex items-center justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white shadow-sm'} border`}>
                              <div>
                                <p className="font-black text-sm">{issue.book?.title} <span className="text-[10px] text-slate-400">({issue.book?.rack_number})</span></p>
                                <p className="text-xs font-bold text-slate-500 mt-1">{issue.user_type === 'student' ? issue.student?.student_name : issue.teacher?.name} <span className="opacity-60">{issue.user_type}</span></p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-red-500 uppercase">Due: {new Date(issue.due_date).toLocaleDateString()}</p>
                                <button onClick={() => handleReturnBook(issue)} className="mt-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg">Return</button>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'books' && (
              <div className="space-y-6">
                <div className={`flex items-center gap-3 p-2 rounded-2xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white shadow-sm border border-slate-200'}`}>
                  <Search size={20} className="ml-3 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? "বইয়ের নাম, লেখক, র্যাক..." : "Search books, authors, rack..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold p-2 min-w-[200px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBooks.map(book => (
                    <div key={book.id} className={`p-5 rounded-[2rem] border relative group ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-premium'}`}>
                      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditBook(book)} className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} transition-colors`}><Edit size={14} /></button>
                         <button onClick={() => handleDeleteBook(book.id)} className={`p-2 rounded-xl ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'} transition-colors`}><Trash2 size={14} /></button>
                      </div>
                      
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`w-12 h-14 shrink-0 rounded-lg flex items-center justify-center border-2 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                           <BookMarked size={20} />
                        </div>
                        <div className="flex-1 min-w-0 pr-16">
                           <h3 className="font-black text-sm truncate">{book.title}</h3>
                           <p className="text-xs font-bold text-slate-500 truncate mt-0.5">{book.author || 'Unknown'}</p>
                           <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isDark ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'} border`}>
                              {book.category || 'General'}
                           </span>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between p-3 rounded-2xl ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                         <div className="text-center flex-1 border-r border-slate-200/20">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                            <p className="font-mono text-sm font-black">{book.quantity}</p>
                         </div>
                         <div className="text-center flex-1 border-r border-slate-200/20">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avail</p>
                            <p className={`font-mono text-sm font-black ${book.available_quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{book.available_quantity}</p>
                         </div>
                         <div className="text-center flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rack</p>
                            <p className="font-mono text-sm font-black text-blue-500">{book.rack_number || '--'}</p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'issues' && (
              <div className="space-y-4">
                 {issues.map(issue => (
                   <div key={issue.id} className={`p-4 md:p-5 rounded-[2rem] border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white shadow-sm'}`}>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${issue.status === 'returned' ? 'bg-emerald-500/10 text-emerald-500' : issue.status === 'lost' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                               {issue.status}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{issue.user_type}</span>
                         </div>
                         <h3 className="font-black text-sm">{issue.book?.title}</h3>
                         <p className="text-xs font-bold text-slate-500 mt-1">{issue.user_type === 'student' ? issue.student?.student_name + (issue.student?.roll ? ` (Roll: ${issue.student.roll})` : '') : issue.teacher?.name}</p>
                      </div>
                      <div className={`p-3 rounded-xl flex items-center gap-6 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50'} border`}>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">Issue Date</p>
                            <p className="font-bold text-xs">{new Date(issue.issue_date).toLocaleDateString()}</p>
                         </div>
                         <div>
                            <p className={`text-[9px] font-black uppercase ${issue.status === 'issued' && issue.due_date < new Date().toISOString().split('T')[0] ? 'text-red-500' : 'text-slate-400'}`}>Due Date</p>
                            <p className={`font-bold text-xs ${issue.status === 'issued' && issue.due_date < new Date().toISOString().split('T')[0] ? 'text-red-500' : ''}`}>{new Date(issue.due_date).toLocaleDateString()}</p>
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         {issue.status === 'issued' && (
                            <button onClick={() => handleReturnBook(issue)} className="w-full md:w-auto px-6 py-3 bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 active:scale-95 transition-all shadow-premium">
                               Return Item
                            </button>
                         )}
                         {issue.status === 'returned' && (
                            <div className="flex items-center justify-end gap-1 text-emerald-500 text-[10px] font-black uppercase"><CheckCircle2 size={12} /> Returned on {issue.return_date ? new Date(issue.return_date).toLocaleDateString() : ''}</div>
                         )}
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Book Modal */}
      {(showAddBook || editBook) && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
           <div className={`w-full max-w-lg ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} rounded-[3rem] shadow-2xl border overflow-hidden p-6 md:p-8 animate-in zoom-in-95 duration-300`}>
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-black">{editBook ? (lang === 'bn' ? 'বই আপডেট করুন' : 'Edit Book') : (lang === 'bn' ? 'নতুন বই যুক্ত করুন' : 'Add New Book')}</h2>
               <button onClick={() => { setShowAddBook(false); setEditBook(null); }} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
             </div>
             
             <form onSubmit={editBook ? handleUpdateBook : handleCreateBook} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 px-2">Book Title</label>
                  <input type="text" name="title" defaultValue={editBook?.title} required className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2">Author</label>
                    <input type="text" name="author" defaultValue={editBook?.author} className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2">Category</label>
                    <input type="text" name="category" defaultValue={editBook?.category} className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2">Total Quantity</label>
                    <input type="number" min="1" name="quantity" defaultValue={editBook?.quantity || 1} required className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2">Rack Number</label>
                    <input type="text" name="rack_number" defaultValue={editBook?.rack_number} className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
                 </div>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 px-2">Description</label>
                  <textarea name="description" defaultValue={editBook?.description} className={`w-full h-24 p-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none resize-none`} />
               </div>
               <button type="submit" className="w-full h-14 bg-blue-600 text-white font-black rounded-2xl active:scale-95 transition-all shadow-premium mt-4">
                  {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Book'}
               </button>
             </form>
           </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
           <div className={`w-full max-w-lg ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} rounded-[3rem] shadow-2xl border overflow-hidden p-6 md:p-8 animate-in zoom-in-95 duration-300`}>
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-black flex items-center gap-3"><BookOpenCheck className="text-indigo-500" /> {lang === 'bn' ? 'বই ইস্যু করুন' : 'Issue Book'}</h2>
               <button onClick={() => setShowIssueModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"><ArrowLeft size={20} /></button>
             </div>
             
             <form onSubmit={handleIssueBook} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 px-2">Select Book</label>
                  <select name="book_id" required className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none appearance-none`}>
                     <option value="">-- Select Book --</option>
                     {books.filter(b => b.available_quantity > 0).map(b => (
                       <option key={b.id} value={b.id}>{b.title} (Avail: {b.available_quantity})</option>
                     ))}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2">User Type</label>
                    <select name="user_type" required id="userTypeSelect" onChange={(e) => {setIssueUserType(e.target.value as 'student'|'teacher'); setIssueClassId(''); setUserSearch('');}} value={issueUserType} className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none appearance-none`}>
                       <option value="student">{lang === 'bn' ? 'শিক্ষার্থী' : 'Student'}</option>
                       <option value="teacher">{lang === 'bn' ? 'শিক্ষক' : 'Teacher'}</option>
                    </select>
                 </div>
                 {issueUserType === 'student' && (
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2">{lang === 'bn' ? 'শ্রেণী নির্বাচন' : 'Select Class'}</label>
                    <select value={issueClassId} onChange={(e) => setIssueClassId(e.target.value)} required className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none appearance-none`}>
                       <option value="">-- {lang === 'bn' ? 'শ্রেণী নির্বাচন করুন' : 'Select Class'} --</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                 </div>
                 )}
               </div>
               <div>
                  <div className="flex items-center justify-between px-2 pb-1">
                     <label className="text-[10px] font-black uppercase text-slate-400">{lang === 'bn' ? 'ইউজার নির্বাচন' : 'Select User'}</label>
                     <input type="text" placeholder={lang === 'bn' ? "নাম/রোল খুঁজুন..." : "Search name/roll..."} value={userSearch} onChange={e => setUserSearch(e.target.value)} className={`w-32 bg-transparent text-[10px] font-bold outline-none border-b ${isDark ? 'border-slate-700 text-white placeholder-slate-500 focus:border-blue-500' : 'border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500'}`} />
                  </div>
                  <select name="active_user_id" required className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none appearance-none`}>
                     <option value="">-- {lang === 'bn' ? 'নির্বাচন করুন' : 'Select'} --</option>
                     {issueUserType === 'student' ? (
                        students
                           .filter(s => s.class_id === issueClassId)
                           .filter(s => (s.student_name || '').toLowerCase().includes((userSearch || '').toLowerCase()) || (s.roll && String(s.roll).includes(userSearch)))
                           .map(s => <option key={s.id} value={s.id}>{s.student_name} {s.roll ? `(Roll: ${s.roll})` : ''}</option>)
                     ) : (
                        teachers
                           .filter(t => (t.name || '').toLowerCase().includes((userSearch || '').toLowerCase()))
                           .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                     )}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 px-2">Due Date</label>
                  <input type="date" name="due_date" required className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 px-2">Remarks / Notes</label>
                  <input type="text" name="notes" className={`w-full h-12 px-5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 focus:bg-white'} text-sm font-bold outline-none`} />
               </div>
               <button type="submit" className="w-full h-14 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 transition-all shadow-premium mt-4">
                  Confirm Issue
               </button>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}

const TabButton = ({ active, onClick, icon, title, isDark }: any) => (
  <button
    onClick={onClick}
    className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shrink-0 flex items-center gap-2 border-2 transition-all duration-300
      ${active 
        ? (isDark ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-100')
        : (isDark ? 'bg-transparent border-slate-700/50 text-slate-400 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 active:scale-95')
      }`}
  >
    {icon} {title}
  </button>
);

const StatCard = ({ title, value, icon, isDark, color }: any) => {
  const colorMap: any = {
    blue: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
    red: isDark ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className={`p-4 md:p-5 rounded-[2rem] border relative overflow-hidden group ${isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-100 hover:shadow-premium'} transition-all`}>
       <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${colorMap[color]} shadow-sm mb-3`}>
         {icon}
       </div>
       <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
       <p className={`text-2xl md:text-3xl font-black font-mono mt-1 ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight`}>{value}</p>
    </div>
  );
};
