import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Sparkles,
  Printer,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Sliders,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  FileText,
  AlertCircle,
  FileCode,
  Crown,
  RefreshCw,
  ArrowLeft,
  Columns,
  CheckCircle2,
  FolderOpen,
  GripVertical,
  Check,
  X,
  Type
} from 'lucide-react';
import { Institution, Language, Profile } from '../types';
import {
  QBBook,
  QBChapter,
  QBQuestion,
  PaperSection,
  PaperQuestion,
  PaperConfig,
  QBSavedPaper,
  SUPPORTED_BOARDS,
  SUPPORTED_CLASSES,
  QUESTION_CATEGORIES,
  QuestionBankService,
  toBnNum,
  toArabicNum,
  getNumberingLabel,
  doesBoardMatch,
  doesClassMatch
} from '../services/questionBankService';

interface QuestionBuilderStudioProps {
  madrasah: Institution | null;
  lang: Language;
  onBack: () => void;
  role?: string;
  profile?: Profile | null;
  onUpgradeClick?: () => void;
}

export const QuestionBuilderStudio: React.FC<QuestionBuilderStudioProps> = ({
  madrasah,
  lang,
  onBack,
  role = 'madrasah_admin',
  profile,
  onUpgradeClick
}) => {
  // Pro / Subscription Status Check
  const isSuperAdmin = role === 'super_admin';
  const hasActiveSubscription = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!madrasah) return false;
    if (madrasah.status === 'active') return true;
    if (madrasah.is_super_admin) return true;
    if (madrasah.status === 'trial' && madrasah.created_at) {
      const created = new Date(madrasah.created_at);
      const expiry = new Date(created.getTime() + 3 * 24 * 60 * 60 * 1000);
      return new Date() <= expiry;
    }
    return false;
  }, [madrasah, isSuperAdmin]);

  const [showProModal, setShowProModal] = useState(false);
  const [proModalReason, setProModalReason] = useState<string>('');

  // Mobile navigation pane
  const [mobilePane, setMobilePane] = useState<'library' | 'paper' | 'settings'>('paper');

  // --- FILTERS STATE (Left Pane) ---
  const [selectedBoardId, setSelectedBoardId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loaded DB Library
  const [books, setBooks] = useState<QBBook[]>([]);
  const [chapters, setChapters] = useState<QBChapter[]>([]);
  const [allQuestions, setAllQuestions] = useState<QBQuestion[]>([]);
  const [savedPapers, setSavedPapers] = useState<QBSavedPaper[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(true);
  const [openAccordionCats, setOpenAccordionCats] = useState<Record<string, boolean>>({});

  // --- PAPER SHEET STATE (Center Pane) ---
  const [bismillahText, setBismillahText] = useState<string>('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  const [instNameText, setInstNameText] = useState<string>(
    madrasah?.name || 'আল-জামিয়া আল-ইসলামিয়া দারুল উলুম'
  );
  const [instAddressText, setInstAddressText] = useState<string>(
    madrasah?.address || 'আগ্রাবাদ, চট্টগ্রাম'
  );
  const [examTitleText, setExamTitleText] = useState<string>('বার্ষিক মূল্যায়ন পরীক্ষা - ২০২৬');
  const [classSubLineText, setClassSubLineText] = useState<string>(
    'শ্রেণি: ৩য়  |  বিষয়: কুরআন মাজীদ ও তাজবীদ  |  বিষয় কোড: ১০১'
  );
  const [examTimeText, setExamTimeText] = useState<string>('২ ঘণ্টা ৩০ মিনিট');
  const [examMarksText, setExamMarksText] = useState<string>('১০০');

  // Config toggles & sliders
  const [showBismillah, setShowBismillah] = useState<boolean>(true);
  const [showStudentInfo, setShowStudentInfo] = useState<boolean>(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState<boolean>(false);
  const [paperSize, setPaperSize] = useState<'A4' | 'Legal'>('A4');
  const [borderStyle, setBorderStyle] = useState<'none' | 'single' | 'double'>('double');

  // Typography sliders
  const [fontSize, setFontSize] = useState<number>(14.5);
  const [lineHeight, setLineHeight] = useState<number>(1.5);
  const [questionGap, setQuestionGap] = useState<number>(6);
  const [banglaFont, setBanglaFont] = useState<string>('SolaimanLipi');
  const [arabicFont, setArabicFont] = useState<string>('Scheherazade New');
  const [englishFont, setEnglishFont] = useState<string>('Times New Roman');

  // Sections
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag and drop tracking
  const dragItem = useRef<{ type: 'section' | 'question'; secIdx: number; qIdx?: number; data?: any } | null>(null);

  // Auto Generator Modal State
  const [showAutoModal, setShowAutoModal] = useState<boolean>(false);
  const [autoTargetMarks, setAutoTargetMarks] = useState<number>(100);
  const [autoMcqCount, setAutoMcqCount] = useState<number>(10);
  const [autoFillBlankCount, setAutoFillBlankCount] = useState<number>(5);
  const [autoShortCount, setAutoShortCount] = useState<number>(5);
  const [autoBroadCount, setAutoBroadCount] = useState<number>(3);
  const [autoArabicCount, setAutoArabicCount] = useState<number>(2);

  // Load initial books, chapters & saved drafts
  useEffect(() => {
    let isMounted = true;
    setIsLoadingLibrary(true);
    Promise.all([
      QuestionBankService.getBooks('all'),
      QuestionBankService.getAllChapters(),
      QuestionBankService.getSavedPapers(madrasah?.id)
    ]).then(([loadedBooks, allChs, drafts]) => {
      if (!isMounted) return;
      setBooks(loadedBooks);
      setChapters(allChs);
      setSavedPapers(drafts);
      if (loadedBooks.length > 0) {
        setSelectedBookId(loadedBooks[0].id);
      }
      setIsLoadingLibrary(false);
    });
    return () => { isMounted = false; };
  }, [madrasah?.id]);

  // Filter books cascading with robust board & class matching
  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchBoard = doesBoardMatch(b.board, selectedBoardId);
      const matchClass = doesClassMatch(b.class_name, selectedClass);
      return matchBoard && matchClass;
    });
  }, [books, selectedBoardId, selectedClass]);

  // When selected book or filtered books change, fetch chapters & questions
  useEffect(() => {
    let isCancelled = false;

    // Determine target books
    const targetBookIds = selectedBookId !== 'all'
      ? [selectedBookId]
      : filteredBooks.map(b => b.id);

    if (targetBookIds.length === 0) {
      setChapters([]);
      setAllQuestions([]);
      return;
    }

    Promise.all([
      QuestionBankService.getChapters(targetBookIds),
      QuestionBankService.getQuestions({ bookIds: targetBookIds })
    ]).then(([chs, qs]) => {
      if (isCancelled) return;
      setChapters(chs);
      setAllQuestions(qs);
      initDefaultAccordions(qs);

      // Auto set initial exam paper if blank and a specific book is selected
      if (sections.length === 0 && qs.length > 0 && selectedBookId !== 'all') {
        QuestionBankService.autoGenerateExam({
          bookId: selectedBookId,
          mcqCount: 5,
          fillBlankCount: 5,
          shortCount: 4,
          broadCount: 2,
          arabicCount: 1
        }).then(defaultSecs => {
          if (!isCancelled) setSections(defaultSecs);
        });
      }

      // Update paper header subject info
      const currBook = books.find(b => b.id === selectedBookId);
      if (currBook) {
        setClassSubLineText(`শ্রেণি: ${currBook.class_name}  |  বিষয়: ${currBook.title}  |  বোর্ড: ${currBook.board}`);
      }
    });

    return () => { isCancelled = true; };
  }, [selectedBookId, filteredBooks, books]);

  // Filter chapters - strictly isolated to books in filteredBooks!
  const filteredChapters = useMemo(() => {
    const validBookIds = new Set(filteredBooks.map(b => b.id));
    let chs = chapters.filter(c => validBookIds.has(c.book_id));
    if (selectedBookId && selectedBookId !== 'all') {
      chs = chs.filter(c => c.book_id === selectedBookId);
    }
    return chs;
  }, [chapters, filteredBooks, selectedBookId]);

  // Ensure selected chapter remains valid when filteredChapters changes
  useEffect(() => {
    if (selectedChapterId !== 'all' && !filteredChapters.some(c => c.id === selectedChapterId)) {
      setSelectedChapterId('all');
    }
  }, [filteredChapters, selectedChapterId]);

  // Helper to expand all categories by default
  const initDefaultAccordions = (qs: QBQuestion[]) => {
    const acc: Record<string, boolean> = {};
    qs.forEach(q => { acc[q.category_type] = true; });
    setOpenAccordionCats(acc);
  };

  // Filter questions for Left Pane - strictly isolated to books in filteredBooks!
  const filteredQuestions = useMemo(() => {
    const validBookIds = new Set(filteredBooks.map(b => b.id));
    let list = allQuestions.filter(q => validBookIds.has(q.book_id));

    if (selectedBookId !== 'all') {
      list = list.filter(q => q.book_id === selectedBookId);
    }
    if (selectedChapterId !== 'all') {
      list = list.filter(q => q.chapter_id === selectedChapterId);
    }
    if (selectedCategory !== 'all') {
      list = list.filter(q => q.category_type === selectedCategory);
    }
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      list = list.filter(q =>
        q.question_text?.toLowerCase().includes(qLower) ||
        (q.answer_text && q.answer_text.toLowerCase().includes(qLower)) ||
        (q.options && q.options.some(opt => opt.toLowerCase().includes(qLower)))
      );
    }

    // Free preview limitation: max 5 questions per chapter
    if (!hasActiveSubscription) {
      const countMap: Record<string, number> = {};
      const capped: QBQuestion[] = [];
      for (const item of list) {
        const count = countMap[item.chapter_id] || 0;
        if (count < 5) {
          countMap[item.chapter_id] = count + 1;
          capped.push(item);
        }
      }
      return capped;
    }

    return list;
  }, [allQuestions, filteredBooks, selectedBookId, selectedChapterId, selectedCategory, searchQuery, hasActiveSubscription]);

  // Group filtered questions by category for Accordions
  const questionsByCategory = useMemo(() => {
    const map: Record<string, QBQuestion[]> = {};
    filteredQuestions.forEach(q => {
      const cat = q.category_type || 'অন্যান্য প্রশ্ন';
      if (!map[cat]) map[cat] = [];
      map[cat].push(q);
    });
    return map;
  }, [filteredQuestions]);

  // Check if a question is already on paper
  const questionOnPaperMap = useMemo(() => {
    const set = new Set<string>();
    sections.forEach(s => {
      s.questions.forEach(q => {
        if (q.original_id) set.add(q.original_id);
      });
    });
    return set;
  }, [sections]);

  // Real-time marks sum
  const totalCalculatedMarks = useMemo(() => {
    return sections.reduce((sum, sec) => {
      const secMarks = sec.questions.reduce((qSum, q) => qSum + (Number(q.marks) || 0), 0);
      return sum + secMarks;
    }, 0);
  }, [sections]);

  // Toast feedback helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Add question to paper
  const addQuestionToPaper = (q: QBQuestion, targetSecId?: string) => {
    setSections(prev => {
      let targetSec = targetSecId ? prev.find(s => s.id === targetSecId) : null;
      if (!targetSec) {
        targetSec = prev.find(s => s.category_type === q.category_type) || prev[0];
      }

      const newQ: PaperQuestion = {
        id: `pq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        original_id: q.id,
        question_text: q.question_text,
        category_type: q.category_type,
        options: q.options ? [...q.options] : undefined,
        answer_text: q.answer_text,
        marks: q.default_marks || 1
      };

      if (!targetSec) {
        const newSec: PaperSection = {
          id: `sec-${Date.now()}`,
          category_type: q.category_type,
          title: `${toBnNum(prev.length + 1)}। ${q.category_type}:`,
          layout: q.options && q.options.length > 0 ? '2_col' : '1_col',
          numbering_style: 'bangla_letter',
          direction: q.category_type.includes('আরবি') ? 'rtl' : 'ltr',
          dotted_lines: 0,
          marks_formula: `১ × ১ = ১`,
          total_marks: 1,
          questions: [newQ]
        };
        return [...prev, newSec];
      }

      return prev.map(s => {
        if (s.id === targetSec?.id) {
          const updatedQs = [...s.questions, newQ];
          const newTotal = updatedQs.reduce((acc, curr) => acc + (curr.marks || 1), 0);
          return {
            ...s,
            questions: updatedQs,
            total_marks: newTotal,
            marks_formula: `${toBnNum(q.default_marks || 1)} × ${toBnNum(updatedQs.length)} = ${toBnNum(newTotal)}`
          };
        }
        return s;
      });
    });

    triggerToast('প্রশ্নপত্রটিতে যোগ হয়েছে');
  };

  // Bulk add from category
  const addRandomFromCategory = (catName: string, count: number) => {
    const list = questionsByCategory[catName] || [];
    if (list.length === 0) return;
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count);
    picked.forEach(q => addQuestionToPaper(q));
    triggerToast(`${toBnNum(picked.length)}টি প্রশ্ন যোগ করা হয়েছে`);
  };

  // Fast preset quick-section adding
  const addQuickSection = (type: 'short' | 'fill' | 'mcq' | 'words' | 'alphabet' | 'arabic') => {
    let title = '';
    let category = '';
    let layout: PaperSection['layout'] = '1_col';
    let direction: 'ltr' | 'rtl' = 'ltr';
    let numbering: PaperSection['numbering_style'] = 'bangla_letter';

    switch (type) {
      case 'short':
        title = `${toBnNum(sections.length + 1)}। সংক্ষেপে উত্তর দাও:`;
        category = 'সংক্ষিপ্ত প্রশ্ন';
        layout = '1_col';
        break;
      case 'fill':
        title = `${toBnNum(sections.length + 1)}। উপযুক্ত শব্দ দিয়ে শূন্যস্থান পূরণ করো:`;
        category = 'শূন্যস্থান পূরণ করো';
        layout = '1_col';
        break;
      case 'mcq':
        title = `${toBnNum(sections.length + 1)}। সঠিক উত্তরটির পাশে টিক (✔) চিহ্ন দাও:`;
        category = 'সঠিক উত্তরটি বেছে নাও (MCQ)';
        layout = '2_col';
        break;
      case 'words':
        title = `${toBnNum(sections.length + 1)}। নিচের শব্দগুলোর অর্থ লেখো:`;
        category = 'শব্দার্থ লেখো';
        layout = '3_col';
        break;
      case 'alphabet':
        title = `${toBnNum(sections.length + 1)}। হরফ ও বর্ণমালা সুন্দর করে লেখো:`;
        category = 'বর্ণ/হরফ';
        layout = '4_col';
        break;
      case 'arabic':
        title = `${toBnNum(sections.length + 1)}। أجب عن الأسئلة الآتية (আরবিতে উত্তর দাও):`;
        category = 'আরবি প্রশ্ন';
        layout = '1_col';
        direction = 'rtl';
        numbering = 'arabic_number';
        break;
    }

    const newSec: PaperSection = {
      id: `sec-${Date.now()}`,
      category_type: category,
      title,
      layout,
      numbering_style: numbering,
      direction,
      dotted_lines: 0,
      marks_formula: '১ × ৫ = ৫',
      total_marks: 5,
      questions: []
    };

    setSections(prev => [...prev, newSec]);
    triggerToast(`"${category}" বিভাগ যুক্ত হয়েছে`);
  };

  // Section manipulation
  const moveSection = (idx: number, dir: 'up' | 'down') => {
    setSections(prev => {
      const copy = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= copy.length) return prev;
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const deleteSection = (secId: string) => {
    setSections(prev => prev.filter(s => s.id !== secId));
    triggerToast('বিভাগ মুছে ফেলা হয়েছে');
  };

  // Question manipulation
  const moveQuestion = (secIdx: number, qIdx: number, dir: 'up' | 'down') => {
    setSections(prev => {
      const copy = [...prev];
      const sec = copy[secIdx];
      if (!sec) return prev;
      const qCopy = [...sec.questions];
      const target = dir === 'up' ? qIdx - 1 : qIdx + 1;
      if (target < 0 || target >= qCopy.length) return prev;
      const temp = qCopy[qIdx];
      qCopy[qIdx] = qCopy[target];
      qCopy[target] = temp;
      copy[secIdx] = { ...sec, questions: qCopy };
      return copy;
    });
  };

  const deleteQuestion = (secId: string, qId: string) => {
    setSections(prev => {
      return prev.map(s => {
        if (s.id !== secId) return s;
        const remaining = s.questions.filter(q => q.id !== qId);
        const newTotal = remaining.reduce((sum, curr) => sum + (curr.marks || 1), 0);
        return {
          ...s,
          questions: remaining,
          total_marks: newTotal
        };
      });
    });
  };

  const addCustomQuestion = (secId: string) => {
    const customQ: PaperQuestion = {
      id: `custom-${Date.now()}`,
      category_type: 'কাস্টম',
      question_text: 'নতুন প্রশ্নের বিবরণ এখানে ক্লিক করে লিখুন...',
      marks: 1
    };
    setSections(prev => {
      return prev.map(s => {
        if (s.id === secId) {
          const updated = [...s.questions, customQ];
          return {
            ...s,
            questions: updated,
            total_marks: updated.reduce((sum, curr) => sum + (curr.marks || 1), 0)
          };
        }
        return s;
      });
    });
  };

  // 1-Click Design Presets
  const applyPreset = (presetName: 'noorani' | 'befaq' | 'worksheet' | 'compact') => {
    switch (presetName) {
      case 'noorani':
        setBorderStyle('double');
        setShowBismillah(true);
        setShowStudentInfo(false);
        setFontSize(15);
        setLineHeight(1.5);
        setQuestionGap(7);
        setBanglaFont('SolaimanLipi');
        setArabicFont('Scheherazade New');
        setEnglishFont('Times New Roman');
        break;
      case 'befaq':
        setBorderStyle('single');
        setShowBismillah(true);
        setShowStudentInfo(false);
        setFontSize(15);
        setLineHeight(1.4);
        setQuestionGap(6);
        setBanglaFont('Noto Serif Bengali');
        setArabicFont('Amiri');
        setEnglishFont('Times New Roman');
        break;
      case 'worksheet':
        setBorderStyle('single');
        setShowBismillah(true);
        setShowStudentInfo(true);
        setFontSize(16);
        setLineHeight(1.6);
        setQuestionGap(12);
        setBanglaFont('Hind Siliguri');
        setArabicFont('Lateef');
        setEnglishFont('Inter');
        setSections(prev => prev.map(s => ({ ...s, dotted_lines: 1 })));
        break;
      case 'compact':
        setBorderStyle('none');
        setShowBismillah(false);
        setShowStudentInfo(false);
        setFontSize(13);
        setLineHeight(1.35);
        setQuestionGap(3);
        setBanglaFont('SolaimanLipi');
        setArabicFont('Noto Naskh Arabic');
        setEnglishFont('Times New Roman');
        setSections(prev => prev.map(s => ({ ...s, layout: '2_col', dotted_lines: 0 })));
        break;
    }
    triggerToast(`"${presetName}" টেমপ্লেট প্রয়োগ করা হয়েছে`);
  };

  // Save draft
  const saveCurrentDraft = async () => {
    setIsSaving(true);
    const paperPayload: QBSavedPaper = {
      id: `paper-${Date.now()}`,
      madrasa_id: madrasah?.id || 'demo-inst',
      user_id: profile?.id,
      title: `${classSubLineText.split('|')[1]?.trim() || 'প্রশ্নপত্র'} - ${examTitleText}`,
      exam_name: examTitleText,
      class_name: classSubLineText.split('|')[0]?.trim() || '',
      subject_name: classSubLineText.split('|')[1]?.trim() || '',
      total_marks: totalCalculatedMarks,
      time_duration: examTimeText,
      paper_config: {
        bismillah_type: showBismillah ? 'arabic' : 'none',
        madrasah_name: instNameText,
        madrasah_address: instAddressText,
        exam_title: examTitleText,
        class_name: classSubLineText,
        subject_name: '',
        subject_code: '',
        time_duration: examTimeText,
        target_marks: totalCalculatedMarks,
        show_student_info_box: showStudentInfo,
        show_instructions: true,
        instructions_text: '',
        font_size: fontSize,
        line_height: lineHeight,
        question_gap: questionGap,
        border_style: borderStyle,
        style_preset: 'custom',
        bangla_font: banglaFont,
        arabic_font: arabicFont,
        english_font: englishFont,
        paper_size: paperSize
      },
      sections_data: sections,
      created_at: new Date().toISOString()
    };

    const res = await QuestionBankService.savePaper(paperPayload);
    setIsSaving(false);
    if (res.success) {
      triggerToast('ড্রাফট সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে!');
      QuestionBankService.getSavedPapers(madrasah?.id).then(setSavedPapers);
    } else {
      triggerToast('লোকাল স্টোরেজে সংরক্ষিত হয়েছে');
    }
  };

  // Clear all drafts
  const clearAllDrafts = () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে সংরক্ষিত সব ড্রাফট মুছে ফেলতে চান?')) return;
    localStorage.removeItem('deenora_saved_question_papers');
    setSavedPapers([]);
    triggerToast('সকল ড্রাফট মুছে ফেলা হয়েছে');
  };

  // Delete single draft
  const deleteDraft = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await QuestionBankService.deleteSavedPaper(paperId);
    setSavedPapers(prev => prev.filter(p => p.id !== paperId));
    triggerToast('ড্রাফট মুছে ফেলা হয়েছে');
  };

  // Print / PDF Export
  const printPaper = () => {
    if (!hasActiveSubscription) {
      setProModalReason('প্রিন্ট ও PDF ডাউনলোডের জন্য প্রিমিয়াম প্ল্যানে আপগ্রেড করুন');
      setShowProModal(true);
      return;
    }
    window.print();
  };

  // Export to Word (.doc)
  const exportToWord = () => {
    if (!hasActiveSubscription) {
      setProModalReason('MS Word (.doc) ফরম্যাটে ডাউনলোডের জন্য প্রিমিয়াম প্ল্যানে আপগ্রেড করুন');
      setShowProModal(true);
      return;
    }

    const printElement = document.getElementById('paperSheet');
    if (!printElement) {
      alert('প্রশ্নপত্রের কনটেন্ট পাওয়া যায়নি');
      return;
    }

    const pageDim = paperSize === 'Legal' ? '21.6cm 35.6cm' : '21cm 29.7cm';
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${examTitleText}</title>
        <style>
          @page { size: ${pageDim}; margin: 1.2cm 1.5cm; }
          body {
            font-family: '${banglaFont}', '${englishFont}', Arial, sans-serif;
            font-size: ${fontSize}pt;
            line-height: ${lineHeight};
            color: #000;
          }
          .font-arabic, [dir="rtl"] { font-family: '${arabicFont}', serif !important; }
          .center { text-align: center; }
          .bismillah { font-family: '${arabicFont}', serif !important; font-size: 16pt; font-weight: bold; margin-bottom: 8px; text-align: center; }
          .title { font-size: 20pt; font-weight: bold; margin: 0; text-align: center; }
          .subtitle { font-size: 11pt; margin-bottom: 8px; text-align: center; }
          .meta-table { width: 100%; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-bottom: 12px; font-weight: bold; font-size: 11pt; }
          .section-title { font-size: 12pt; font-weight: bold; margin-top: 12px; margin-bottom: 6px; }
          .write-line { border-bottom: 1px dotted #888; height: 16px; margin: 4px 0; }
        </style>
      </head>
      <body>
        ${printElement.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Exam_Paper_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('MS Word (.doc) ফাইল সফলভাবে প্রস্তুত হয়েছে!');
  };

  // Run Auto Generator
  const executeAutoGenerator = async () => {
    if (!selectedBookId || selectedBookId === 'all') {
      alert('অনুগ্রহ করে প্রথমে একটি পাঠ্যবই নির্বাচন করুন');
      return;
    }

    const generated = await QuestionBankService.autoGenerateExam({
      bookId: selectedBookId,
      mcqCount: autoMcqCount,
      fillBlankCount: autoFillBlankCount,
      shortCount: autoShortCount,
      broadCount: autoBroadCount,
      arabicCount: autoArabicCount
    });

    setSections(generated);
    setExamMarksText(toBnNum(autoTargetMarks));
    setShowAutoModal(false);
    triggerToast('সম্পূর্ণ প্রশ্নপত্র অটোমেটিক তৈরি হয়েছে!');
  };

  // Load a saved draft
  const loadDraft = (paper: QBSavedPaper) => {
    setSections(paper.sections_data);
    setInstNameText(paper.paper_config.madrasah_name || instNameText);
    setInstAddressText(paper.paper_config.madrasah_address || instAddressText);
    setExamTitleText(paper.exam_name || examTitleText);
    setClassSubLineText(paper.paper_config.class_name || classSubLineText);
    setExamTimeText(paper.time_duration || examTimeText);
    setExamMarksText(toBnNum(paper.total_marks || 100));
    if (paper.paper_config.font_size) setFontSize(paper.paper_config.font_size);
    if (paper.paper_config.line_height) setLineHeight(paper.paper_config.line_height);
    if (paper.paper_config.bangla_font) setBanglaFont(paper.paper_config.bangla_font);
    if (paper.paper_config.arabic_font) setArabicFont(paper.paper_config.arabic_font);
    if (paper.paper_config.border_style) setBorderStyle(paper.paper_config.border_style);
    triggerToast(`"${paper.title}" লোড করা হয়েছে`);
    setMobilePane('paper');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-[#f1f5f9] dark:bg-[#090d16] font-noto overflow-hidden select-none">
      {/* ================= 1. TOP BAR (topbar) ================= */}
      <header className="h-14 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="ফিরে যান"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-2">
                <span>প্রশ্নপত্র মেকার স্টুডিও</span>
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  EasyQ Studio
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Live Stats Pills */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            📚 মোট বই: {toBnNum(books.length)} টি
          </span>
          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            📝 প্রশ্নপত্রের বিভাগ: {toBnNum(sections.length)} টি
          </span>
          <span className={`text-xs font-black px-3 py-1 rounded-full border ${
            totalCalculatedMarks === 100
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
          }`}>
            🎯 মোট নম্বর: {toBnNum(totalCalculatedMarks)}
          </span>
        </div>

        {/* Topbar Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 🎲 অটো প্রশ্ন জেনারেটর */}
          <button
            onClick={() => setShowAutoModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:shadow-md transition active:scale-95"
            title="১-ক্লিকে অটো প্রশ্ন জেনারেটর"
          >
            <span>🎲</span>
            <span className="hidden sm:inline">অটো প্রশ্ন জেনারেটর</span>
            <span className="sm:hidden">অটো</span>
          </button>

          {/* 👁️ উত্তরমালা (Answer Sheet) Toggle */}
          <button
            onClick={() => {
              setShowAnswerSheet(!showAnswerSheet);
              triggerToast(showAnswerSheet ? 'উত্তরমালা বন্ধ করা হয়েছে' : 'উত্তরমালা (Answer Sheet) চালু করা হয়েছে');
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
              showAnswerSheet
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
            title="উত্তরমালা মোড টগল"
          >
            <span>👁️</span>
            <span className="hidden md:inline">উত্তরমালা (Answer Sheet)</span>
          </button>

          {/* 💾 সেভ ড্রাফট */}
          <button
            onClick={saveCurrentDraft}
            disabled={isSaving}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition"
            title="ড্রাফট সংরক্ষণ"
          >
            <span>💾</span>
            <span className="hidden sm:inline">সেভ ড্রাফট</span>
          </button>

          {/* 📄 Word (.doc) */}
          <button
            onClick={exportToWord}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800 transition"
            title="Microsoft Word (.doc) ডাউনলোড"
          >
            <span>📄</span>
            <span className="hidden sm:inline">Word (.doc)</span>
          </button>

          {/* 🖨️ প্রিন্ট / PDF */}
          <button
            onClick={printPaper}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition active:scale-95"
            title="প্রিন্ট অথবা PDF সংরক্ষণ"
          >
            <span>🖨️</span>
            <span>প্রিন্ট / PDF</span>
          </button>
        </div>
      </header>

      {/* Mobile Switcher (Small Screens) */}
      <div className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-1 px-2 z-20">
        <button
          onClick={() => setMobilePane('library')}
          className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md ${
            mobilePane === 'library' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
          }`}
        >
          প্রশ্ন সম্ভার
        </button>
        <button
          onClick={() => setMobilePane('paper')}
          className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md ${
            mobilePane === 'paper' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
          }`}
        >
          প্রশ্নপত্র ({toBnNum(totalCalculatedMarks)})
        </button>
        <button
          onClick={() => setMobilePane('settings')}
          className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md ${
            mobilePane === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
          }`}
        >
          সেটিংস
        </button>
      </div>

      {/* ================= 3-PANE WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ================= 2. LEFT PANE (left-pane - 380px) ================= */}
        <aside
          className={`w-full md:w-[380px] bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-20 ${
            mobilePane === 'library' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📖</span>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
                প্রশ্ন সম্ভার (Question Bank)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              {filteredQuestions.length} টি প্রশ্ন
            </span>
          </div>

          {/* Cascading Filter Dropdowns */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-[#111827]">
            {/* 1. Board Selector */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                ১. বোর্ড নির্বাচন করুন (Board):
              </label>
              <select
                value={selectedBoardId}
                onChange={e => {
                  const newBoard = e.target.value;
                  setSelectedBoardId(newBoard);
                  setSelectedChapterId('all');
                  const newFiltered = books.filter(b => doesBoardMatch(b.board, newBoard) && doesClassMatch(b.class_name, selectedClass));
                  if (newFiltered.length > 0) {
                    setSelectedBookId(newFiltered[0].id);
                  } else {
                    setSelectedBookId('all');
                  }
                }}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100"
              >
                {SUPPORTED_BOARDS.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Class Selector */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                ২. শ্রেণি (Class):
              </label>
              <select
                value={selectedClass}
                onChange={e => {
                  const newClass = e.target.value;
                  setSelectedClass(newClass);
                  setSelectedChapterId('all');
                  const newFiltered = books.filter(b => doesBoardMatch(b.board, selectedBoardId) && doesClassMatch(b.class_name, newClass));
                  if (newFiltered.length > 0) {
                    if (!newFiltered.some(b => b.id === selectedBookId)) {
                      setSelectedBookId(newFiltered[0].id);
                    }
                  } else {
                    setSelectedBookId('all');
                  }
                }}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100"
              >
                <option value="all">সকল শ্রেণি (All Classes)</option>
                {SUPPORTED_CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 3. Book Selector */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                ৩. বিষয় / বই (Book):
              </label>
              <select
                value={selectedBookId}
                onChange={e => {
                  setSelectedBookId(e.target.value);
                  setSelectedChapterId('all');
                }}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 truncate"
              >
                <option value="all">সকল বই ({filteredBooks.length})</option>
                {filteredBooks.map(b => (
                  <option key={b.id} value={b.id}>{b.title} ({b.class_name})</option>
                ))}
              </select>
            </div>

            {/* 4. Chapter & 5. Type Row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  ৪. অধ্যায় (Chapter):
                </label>
                <select
                  value={selectedChapterId}
                  onChange={e => setSelectedChapterId(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 truncate"
                >
                  <option value="all">সকল অধ্যায় ({filteredChapters.length})</option>
                  {filteredChapters.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  ৫. প্রশ্নের ধরন (Type):
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 truncate"
                >
                  {QUESTION_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative pt-1">
              <Search className="absolute left-2.5 top-3.5 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="🔍 প্রশ্ন বা উত্তর খুঁজুন..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-7 pr-3 py-1.5 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Question Category Accordions */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {isLoadingLibrary ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-blue-500 mb-2" />
                <span className="text-xs">প্রশ্ন সম্ভার লোড হচ্ছে...</span>
              </div>
            ) : Object.keys(questionsByCategory).length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <AlertCircle size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold">কোনো প্রশ্ন পাওয়া যায়নি</p>
                <p className="text-[11px] text-slate-400 mt-1">ফিল্টার পরিবর্তন করে অনুসন্ধান করুন</p>
              </div>
            ) : (
              Object.entries(questionsByCategory).map(([catName, qList]) => {
                const isOpen = openAccordionCats[catName] !== false;
                return (
                  <div
                    key={catName}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-xs"
                  >
                    {/* Accordion Header with Bulk Action Buttons */}
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-850 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => setOpenAccordionCats(prev => ({ ...prev, [catName]: !isOpen }))}
                        className="flex items-center gap-1.5 text-left flex-1"
                      >
                        {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {catName}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded-full">
                          {toBnNum(qList.length)}
                        </span>
                      </button>

                      {/* Bulk +৫টি and +সব buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => addRandomFromCategory(catName, 5)}
                          className="px-2 py-0.5 text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition"
                          title="এই ক্যাটাগরি থেকে ৫টি র্যান্ডম প্রশ্ন যোগ করুন"
                        >
                          +৫টি
                        </button>
                        <button
                          onClick={() => addRandomFromCategory(catName, 999)}
                          className="px-2 py-0.5 text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition"
                          title="এই ক্যাটাগরির সবগুলো প্রশ্ন যোগ করুন"
                        >
                          +সব
                        </button>
                      </div>
                    </div>

                    {/* Accordion Question Cards */}
                    {isOpen && (
                      <div className="p-2 space-y-2">
                        {qList.map(q => {
                          const isAdded = questionOnPaperMap.has(q.id);
                          return (
                            <div
                              key={q.id}
                              draggable="true"
                              onDragStart={() => {
                                dragItem.current = { type: 'question', secIdx: -1, data: q };
                              }}
                              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-white dark:bg-slate-850 transition relative group cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.2 rounded">
                                  {toBnNum(q.default_marks)} নম্বর
                                </span>
                                <button
                                  onClick={() => addQuestionToPaper(q)}
                                  className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition active:scale-95 ${
                                    isAdded
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check size={11} />
                                      <span>যুক্ত</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus size={11} />
                                      <span>যোগ</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                {q.question_text}
                              </p>

                              {/* Options grid preview if MCQ */}
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-1 mt-1.5 text-[10.5px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded">
                                  {q.options.map((opt, i) => (
                                    <div key={i} className="truncate">
                                      {getNumberingLabel(i, 'bangla_letter')} {opt}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Answer preview */}
                              {q.answer_text && (
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic mt-1 font-medium truncate">
                                  উত্তর: {q.answer_text}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Free preview notice */}
            {!hasActiveSubscription && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-center">
                <Crown size={20} className="mx-auto text-amber-600 mb-1" />
                <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  ফ্রি প্রিভিউ মোড
                </h5>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                  অধ্যায় প্রতি প্রথম ৫টি প্রশ্ন প্রদর্শিত হচ্ছে। ৬২,০০০+ পূর্ণ প্রশ্ন ব্যাংক আনলক করতে আপগ্রেড করুন।
                </p>
                <button
                  onClick={() => {
                    setProModalReason('৬২,০০০+ পূর্ণ প্রশ্ন সম্ভার আনলক করতে প্রো প্যাকেজে আপগ্রেড করুন');
                    setShowProModal(true);
                  }}
                  className="mt-2 w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  প্রো প্যাকেজ আনলক করুন
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ================= 3. CENTER PANE (center-pane - Live A4 Paper Sheet) ================= */}
        <main
          className={`flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center bg-[#cbd5e1]/40 dark:bg-[#070b12] custom-scrollbar ${
            mobilePane === 'paper' ? 'flex' : 'hidden md:flex'
          }`}
          onDragOver={e => e.preventDefault()}
        >
          {/* A4 Paper Sheet Container */}
          <div
            id="paperSheet"
            style={{
              width: paperSize === 'Legal' ? '216mm' : '210mm',
              minHeight: paperSize === 'Legal' ? '356mm' : '297mm',
              padding: '16mm 16mm',
              fontFamily: `'${banglaFont}', '${englishFont}', serif`,
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              ['--paper-q-gap' as any]: `${questionGap}px`
            }}
            className={`w-full bg-white text-black shadow-2xl relative transition-all ${
              borderStyle === 'double'
                ? 'border-4 border-double border-black'
                : borderStyle === 'single'
                ? 'border border-black'
                : 'border-0'
            }`}
          >
            {/* ================= EDITABLE EXAM HEADER ================= */}
            <header className="text-center pb-3 mb-3 border-b-2 border-black">
              {/* #bismillahBox */}
              {showBismillah && (
                <div
                  id="bismillahBox"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setBismillahText(e.currentTarget.textContent || '')}
                  style={{ fontFamily: `'${arabicFont}', serif` }}
                  className="text-lg md:text-xl font-bold mb-1 tracking-wide outline-none focus:bg-blue-50/60 rounded px-2"
                >
                  {bismillahText}
                </div>
              )}

              {/* #instName & Address */}
              <h1
                id="instName"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => setInstNameText(e.currentTarget.textContent || '')}
                className="text-xl md:text-2xl font-black tracking-tight leading-tight outline-none focus:bg-blue-50/60 rounded px-1"
              >
                {instNameText}
              </h1>
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={e => setInstAddressText(e.currentTarget.textContent || '')}
                className="text-xs text-slate-700 outline-none focus:bg-blue-50/60 rounded px-1 mt-0.5"
              >
                {instAddressText}
              </p>

              {/* #examTitle Pill */}
              <div className="inline-block mt-1">
                <span
                  id="examTitle"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setExamTitleText(e.currentTarget.textContent || '')}
                  className="inline-block text-sm md:text-base font-bold px-4 py-0.5 border border-black rounded-full outline-none focus:bg-blue-50/60"
                >
                  {examTitleText}
                </span>
              </div>

              {/* #classSubLine */}
              <div
                id="classSubLine"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => setClassSubLineText(e.currentTarget.textContent || '')}
                className="mt-2 text-xs md:text-sm font-bold text-slate-900 border-t border-black/40 pt-1 outline-none focus:bg-blue-50/60"
              >
                {classSubLineText}
              </div>

              {/* Time & Marks Row */}
              <div className="mt-1 flex items-center justify-between text-xs md:text-sm font-bold border-t border-dotted border-black/40 pt-1">
                <div>
                  <span>সময়: </span>
                  <span
                    id="examTime"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setExamTimeText(e.currentTarget.textContent || '')}
                    className="outline-none focus:bg-blue-50/60 px-1 border-b border-dashed border-slate-400"
                  >
                    {examTimeText}
                  </span>
                </div>

                <div>
                  <span>পূর্ণমান: </span>
                  <span
                    id="examMarks"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setExamMarksText(e.currentTarget.textContent || '')}
                    className="outline-none focus:bg-blue-50/60 px-1 border-b border-dashed border-slate-400"
                  >
                    {toBnNum(totalCalculatedMarks)}
                  </span>
                </div>
              </div>

              {/* Toggleable Student Info Box (#studentInfoBar) */}
              {showStudentInfo && (
                <div
                  id="studentInfoBar"
                  className="mt-2 p-1.5 border border-black text-xs flex justify-between font-bold"
                >
                  <span>শিক্ষার্থীর নাম: _____________________________</span>
                  <span>রোল: ________</span>
                  <span>শাখা: _____</span>
                  <span>তারিখ: _________</span>
                </div>
              )}
            </header>

            {/* ================= SECTIONS & QUESTIONS ================= */}
            <div className="space-y-4">
              {sections.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-xl my-6">
                  <FileText size={36} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-700">
                    প্রশ্নপত্রটি বর্তমানে খালি রয়েছে
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    বামের প্রশ্ন সম্ভার থেকে প্রশ্ন যোগ করুন অথবা "অটো প্রশ্ন জেনারেটর" বাটনে ক্লিক করে স্বয়ংক্রিয় প্রশ্নপত্র সাজান।
                  </p>
                  <button
                    onClick={() => setShowAutoModal(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700"
                  >
                    🎲 অটো প্রশ্ন সাজান
                  </button>
                </div>
              ) : (
                sections.map((section, sIdx) => (
                  <div
                    key={section.id}
                    draggable="true"
                    onDragStart={() => {
                      dragItem.current = { type: 'section', secIdx: sIdx };
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (!dragItem.current) return;
                      if (dragItem.current.type === 'section') {
                        const fromIdx = dragItem.current.secIdx;
                        if (fromIdx !== sIdx) {
                          setSections(prev => {
                            const copy = [...prev];
                            const [moved] = copy.splice(fromIdx, 1);
                            copy.splice(sIdx, 0, moved);
                            return copy;
                          });
                        }
                      } else if (dragItem.current.type === 'question') {
                        // Transfer question to this section
                        const qData = dragItem.current.data;
                        if (qData) {
                          addQuestionToPaper(qData, section.id);
                        }
                      }
                      dragItem.current = null;
                    }}
                    className="q-section relative group/sec pb-2 border-b border-slate-200 last:border-b-0"
                  >
                    {/* FLOATING PER-SECTION TOOLBAR (sec-toolbar) */}
                    <div className="sec-toolbar no-print absolute -top-4 right-0 hidden group-hover/sec:flex items-center gap-1 bg-slate-900 text-white px-2 py-1 rounded-md shadow-lg z-20 text-[11px]">
                      {/* Column Layout Dropdown */}
                      <select
                        value={section.layout}
                        onChange={e => {
                          const val = e.target.value as PaperSection['layout'];
                          setSections(prev => prev.map(s => s.id === section.id ? { ...s, layout: val } : s));
                        }}
                        className="bg-slate-800 text-white text-[10.5px] rounded px-1.5 py-0.5 border border-slate-700 font-medium"
                        title="কলাম বিন্যাস পরিবর্তন"
                      >
                        <option value="1_col">1 কলাম (তালিকা)</option>
                        <option value="2_col">2 কলাম (পাশাপাশি)</option>
                        <option value="3_col">3 কলাম (শব্দার্থ)</option>
                        <option value="4_col">4 কলাম (বর্ণ/শব্দ)</option>
                        <option value="word_box">Word Chips (বক্সে)</option>
                      </select>

                      {/* Numbering Format Dropdown */}
                      <select
                        value={section.numbering_style}
                        onChange={e => {
                          const val = e.target.value as PaperSection['numbering_style'];
                          setSections(prev => prev.map(s => s.id === section.id ? { ...s, numbering_style: val } : s));
                        }}
                        className="bg-slate-800 text-white text-[10.5px] rounded px-1.5 py-0.5 border border-slate-700 font-medium"
                        title="ক্রমিক নম্বর ফরম্যাট"
                      >
                        <option value="bangla_letter">ক, খ, গ...</option>
                        <option value="bangla_number">১, ২, ৩...</option>
                        <option value="english_number">1, 2, 3...</option>
                        <option value="english_letter">a, b, c...</option>
                        <option value="arabic_number">١, ٢, ٣ (আরবি)</option>
                        <option value="none">নাম্বার ছাড়া</option>
                      </select>

                      {/* Direction Toggle Button (dir) */}
                      <button
                        onClick={() => {
                          const nextDir = section.direction === 'rtl' ? 'ltr' : 'rtl';
                          setSections(prev => prev.map(s => s.id === section.id ? { ...s, direction: nextDir } : s));
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                          section.direction === 'rtl'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                        title="টেক্সট ডিরেকশন ও আরবি মোড"
                      >
                        {section.direction === 'rtl' ? '⬅️ আরবি RTL' : '➡️ বাংলা/En'}
                      </button>

                      {/* Worksheet Dotted Answer Lines Dropdown */}
                      <select
                        value={section.dotted_lines || 0}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setSections(prev => prev.map(s => s.id === section.id ? { ...s, dotted_lines: val } : s));
                        }}
                        className="bg-slate-800 text-white text-[10.5px] rounded px-1.5 py-0.5 border border-slate-700 font-medium"
                        title="উত্তর লেখার ডটেড লাইন"
                      >
                        <option value="0">উত্তর লাইন: ০টি</option>
                        <option value="1">১ লাইন</option>
                        <option value="2">২ লাইন</option>
                        <option value="3">৩ লাইন</option>
                        <option value="4">৪ লাইন</option>
                      </select>

                      {/* Move Up ▲ */}
                      <button
                        disabled={sIdx === 0}
                        onClick={() => moveSection(sIdx, 'up')}
                        className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"
                        title="বিভাগ উপরে নিন"
                      >
                        ▲
                      </button>

                      {/* Move Down ▼ */}
                      <button
                        disabled={sIdx === sections.length - 1}
                        onClick={() => moveSection(sIdx, 'down')}
                        className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"
                        title="বিভাগ নিচে নিন"
                      >
                        ▼
                      </button>

                      {/* Add Custom Question + প্রশ্ন */}
                      <button
                        onClick={() => addCustomQuestion(section.id)}
                        className="px-1.5 py-0.5 bg-blue-700 hover:bg-blue-600 rounded text-[10.5px] font-bold"
                        title="কাস্টম প্রশ্ন যোগ করুন"
                      >
                        + প্রশ্ন
                      </button>

                      {/* Delete Section 🗑 */}
                      <button
                        onClick={() => deleteSection(section.id)}
                        className="p-1 hover:bg-red-700 text-red-300 hover:text-white rounded"
                        title="বিভাগ মুছুন"
                      >
                        🗑
                      </button>
                    </div>

                    {/* Section Header: Serial, Title & Marks Formula */}
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <div className="flex items-baseline gap-1.5 flex-1">
                        <span className="font-bold text-sm md:text-base">{toBnNum(sIdx + 1)}।</span>
                        <h3
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => {
                            const newT = e.currentTarget.textContent || '';
                            setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: newT } : s));
                          }}
                          className="font-bold text-sm md:text-base outline-none focus:bg-blue-50/60 rounded px-1 flex-1"
                        >
                          {section.title.replace(/^[০-৯\d]+[।.]\s*/, '')}
                        </h3>
                      </div>

                      {/* Marks Formula (১ × ৫ = ৫) */}
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => {
                          const newF = e.currentTarget.textContent || '';
                          setSections(prev => prev.map(s => s.id === section.id ? { ...s, marks_formula: newF } : s));
                        }}
                        className="text-xs md:text-sm font-bold shrink-0 outline-none focus:bg-blue-50/60 rounded px-1"
                      >
                        {section.marks_formula}
                      </div>
                    </div>

                    {/* Section Questions Grid conforming to layout */}
                    <div
                      dir={section.direction}
                      style={{
                        fontFamily: section.direction === 'rtl' ? `'${arabicFont}', serif` : undefined,
                        fontSize: section.direction === 'rtl' ? `${fontSize + 1.5}px` : undefined,
                        gap: `${questionGap}px`
                      }}
                      className={`grid ${
                        section.layout === '2_col'
                          ? 'grid-cols-1 md:grid-cols-2 gap-x-6'
                          : section.layout === '3_col'
                          ? 'grid-cols-1 md:grid-cols-3 gap-x-4'
                          : section.layout === '4_col'
                          ? 'grid-cols-2 md:grid-cols-4 gap-x-3'
                          : section.layout === 'word_box'
                          ? 'flex flex-wrap gap-2 p-2 border border-black/60 rounded bg-slate-50'
                          : 'grid-cols-1'
                      } ${section.direction === 'rtl' ? 'direction-rtl text-right font-arabic' : ''}`}
                    >
                      {section.questions.map((question, qIdx) => (
                        <div
                          key={question.id}
                          draggable="true"
                          onDragStart={() => {
                            dragItem.current = { type: 'question', secIdx: sIdx, qIdx };
                          }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (!dragItem.current) return;
                            if (dragItem.current.type === 'question') {
                              const fromSec = dragItem.current.secIdx;
                              const fromQ = dragItem.current.qIdx;
                              if (fromSec === sIdx && fromQ !== undefined && fromQ !== qIdx) {
                                moveQuestion(sIdx, fromQ, fromQ < qIdx ? 'down' : 'up');
                              }
                            }
                            dragItem.current = null;
                          }}
                          className={`relative group/q py-1 px-1.5 rounded hover:bg-slate-50 transition flex flex-col ${
                            section.layout === 'word_box'
                              ? 'inline-block px-2.5 py-1 border border-black rounded-md bg-white text-xs font-bold'
                              : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-start gap-1.5 flex-1">
                              {/* Numbering Label */}
                              {section.numbering_style !== 'none' && (
                                <span className="font-bold text-xs select-none shrink-0 pt-0.5">
                                  {getNumberingLabel(qIdx, section.numbering_style)}
                                </span>
                              )}

                              {/* Editable Question Text */}
                              <p
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => {
                                  const newText = e.currentTarget.textContent || '';
                                  setSections(prev => prev.map(s => s.id === section.id ? {
                                    ...s,
                                    questions: s.questions.map(q => q.id === question.id ? { ...q, question_text: newText } : q)
                                  } : s));
                                }}
                                className="text-xs md:text-sm leading-relaxed outline-none focus:bg-blue-50/70 rounded px-0.5 flex-1"
                              >
                                {question.question_text}
                              </p>
                            </div>

                            {/* Marks Badge (editable) */}
                            {section.layout !== 'word_box' && (
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => {
                                  const val = parseFloat(e.currentTarget.textContent?.replace(/[^\d.]/g, '') || '1');
                                  setSections(prev => prev.map(s => {
                                    if (s.id !== section.id) return s;
                                    const updated = s.questions.map(q => q.id === question.id ? { ...q, marks: val } : q);
                                    return {
                                      ...s,
                                      questions: updated,
                                      total_marks: updated.reduce((acc, curr) => acc + (curr.marks || 1), 0)
                                    };
                                  }));
                                }}
                                className="text-xs font-bold text-slate-900 shrink-0 select-none outline-none"
                                title="নম্বর এডিট করুন"
                              >
                                [{toBnNum(question.marks || 1)}]
                              </span>
                            )}
                          </div>

                          {/* Options if MCQ */}
                          {question.options && question.options.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-1 pl-4 text-xs">
                              {question.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-1 truncate">
                                  <span className="font-semibold">{getNumberingLabel(oIdx, 'bangla_letter')}</span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dotted Lines for Handwriting (.write-line) */}
                          {section.dotted_lines && section.dotted_lines > 0 ? (
                            <div className="mt-1.5 space-y-2">
                              {Array.from({ length: section.dotted_lines }).map((_, lIdx) => (
                                <div key={lIdx} className="write-line w-full border-b border-dotted border-slate-500 h-3.5" />
                              ))}
                            </div>
                          ) : null}

                          {/* Answer Sheet Mode (.paper-ans) */}
                          {showAnswerSheet && question.answer_text && (
                            <div className="paper-ans mt-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded inline-block self-start">
                              [উত্তর: {question.answer_text}]
                            </div>
                          )}

                          {/* Floating Question Actions (Hidden on Print) */}
                          <div className="no-print absolute top-0.5 right-0.5 hidden group-hover/q:flex items-center gap-0.5 bg-white border border-slate-300 rounded shadow-xs text-[10px] z-10">
                            <button
                              disabled={qIdx === 0}
                              onClick={() => moveQuestion(sIdx, qIdx, 'up')}
                              className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30"
                              title="উপরে নিন"
                            >
                              ▲
                            </button>
                            <button
                              disabled={qIdx === section.questions.length - 1}
                              onClick={() => moveQuestion(sIdx, qIdx, 'down')}
                              className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30"
                              title="নিচে নিন"
                            >
                              ▼
                            </button>
                            <button
                              onClick={() => deleteQuestion(section.id, question.id)}
                              className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                              title="প্রশ্ন মুছুন"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* ================= 4. RIGHT PANE (right-pane - 300px Settings & Controls) ================= */}
        <aside
          className={`w-full md:w-[300px] bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-20 ${
            mobilePane === 'settings' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders size={15} className="text-blue-600" />
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
                কন্ট্রোল ও সেটিংস (Controls)
              </h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar text-xs">
            {/* রেডিমেড লেআউট টেমপ্লেট (4 Preset Buttons) */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                রেডিমেড লেআউট টেমপ্লেট:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applyPreset('noorani')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/60 dark:bg-slate-850 text-left transition"
                >
                  <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">🕌 নূরানী বোর্ড স্টাইল</div>
                  <div className="text-[9.5px] text-slate-400">ডাবল বর্ডার, মার্জিত</div>
                </button>

                <button
                  onClick={() => applyPreset('befaq')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/60 dark:bg-slate-850 text-left transition"
                >
                  <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">📖 বেফাক / কওমি স্টাইল</div>
                  <div className="text-[9.5px] text-slate-400">অলঙ্কৃত নাসখ স্টাইল</div>
                </button>

                <button
                  onClick={() => applyPreset('worksheet')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/60 dark:bg-slate-850 text-left transition"
                >
                  <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">✏️ শিশু ওয়ার্কশিট মোড</div>
                  <div className="text-[9.5px] text-slate-400">নাম/রোল + লেখার লাইন</div>
                </button>

                <button
                  onClick={() => applyPreset('compact')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/60 dark:bg-slate-850 text-left transition"
                >
                  <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">📄 কমপ্যাক্ট (১ পেজে বেশি)</div>
                  <div className="text-[9.5px] text-slate-400">কাগজ সাশ্রয়ী ২ কলাম</div>
                </button>
              </div>
            </div>

            {/* পেপার ও ফন্ট কাস্টমাইজেশন (Sliders, Font Selectors, Checkboxes) */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Type size={14} className="text-blue-600" />
                <span>পেপার ও ফন্ট কাস্টমাইজেশন:</span>
              </h4>

              {/* 1. Font Size Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                  <span>ফন্টের আকার (Font Size)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="22"
                  step="0.5"
                  value={fontSize}
                  onChange={e => setFontSize(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* 2. Line Height Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                  <span>লাইনের দূরত্ব (Line Height)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{lineHeight}</span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="2.2"
                  step="0.05"
                  value={lineHeight}
                  onChange={e => setLineHeight(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* 3. Question Gap Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                  <span>প্রশ্নের গ্যাপ (Gap)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{questionGap}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="18"
                  step="1"
                  value={questionGap}
                  onChange={e => setQuestionGap(parseInt(e.target.value) || 6)}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* বাংলা ফন্ট Selector */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">
                  বাংলা ফন্ট (Bangla Font):
                </label>
                <select
                  value={banglaFont}
                  onChange={e => setBanglaFont(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100"
                >
                  <option value="SolaimanLipi">SolaimanLipi</option>
                  <option value="Noto Serif Bengali">Noto Serif Bengali</option>
                  <option value="Kalpurush">Kalpurush</option>
                  <option value="Hind Siliguri">Hind Siliguri</option>
                  <option value="Tiro Bangla">Tiro Bangla</option>
                </select>
              </div>

              {/* আরবি ফন্ট Selector */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">
                  আরবি ফন্ট (Arabic Font):
                </label>
                <select
                  value={arabicFont}
                  onChange={e => setArabicFont(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100"
                >
                  <option value="Scheherazade New">Scheherazade New</option>
                  <option value="Amiri">Amiri</option>
                  <option value="Lateef">Lateef</option>
                  <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
                  <option value="Noto Nastaliq Urdu">Noto Nastaliq Urdu</option>
                </select>
              </div>

              {/* ইংরেজি ফন্ট Selector */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">
                  ইংরেজি ফন্ট (English Font):
                </label>
                <select
                  value={englishFont}
                  onChange={e => setEnglishFont(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100"
                >
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="EB Garamond">EB Garamond</option>
                  <option value="Merriweather">Merriweather</option>
                </select>
              </div>

              {/* পেপার সাইজ Selector */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">
                  পেপার সাইজ (Paper Size):
                </label>
                <select
                  value={paperSize}
                  onChange={e => setPaperSize(e.target.value as 'A4' | 'Legal')}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 font-bold"
                >
                  <option value="A4">A4 পেপার (210 × 297 mm)</option>
                  <option value="Legal">Legal পেপার (216 × 356 mm)</option>
                </select>
              </div>

              {/* পেপার বর্ডার ফ্রেম */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">
                  পেপার বর্ডার ফ্রেম:
                </label>
                <select
                  value={borderStyle}
                  onChange={e => setBorderStyle(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100"
                >
                  <option value="none">সাধারণ (No Border)</option>
                  <option value="single">সিঙ্গেল বর্ডার</option>
                  <option value="double">ডাবল বর্ডার ফ্রেম</option>
                </select>
              </div>

              {/* Checkboxes: Bismillah & Student Info */}
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showBismillah}
                    onChange={e => setShowBismillah(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-[11px]">বিসমিল্লাহ হেডার</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showStudentInfo}
                    onChange={e => setShowStudentInfo(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-[11px]">শিক্ষার্থীর নাম/রোল বক্স</span>
                </label>
              </div>
            </div>

            {/* দ্রুত নতুন বিভাগ যোগ করুন (6 Quick Section Buttons) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                দ্রুত নতুন বিভাগ যোগ করুন:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => addQuickSection('short')}
                  className="p-1.5 text-left rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  + সংক্ষিপ্ত প্রশ্ন
                </button>
                <button
                  onClick={() => addQuickSection('fill')}
                  className="p-1.5 text-left rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  + শূন্যস্থান পূরণ
                </button>
                <button
                  onClick={() => addQuickSection('mcq')}
                  className="p-1.5 text-left rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  + বহুনির্বাচনী MCQ
                </button>
                <button
                  onClick={() => addQuickSection('words')}
                  className="p-1.5 text-left rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  + শব্দার্থ (৩ কলাম)
                </button>
                <button
                  onClick={() => addQuickSection('alphabet')}
                  className="p-1.5 text-left rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  + বর্ণমালা (৪ কলাম)
                </button>
                <button
                  onClick={() => addQuickSection('arabic')}
                  className="p-1.5 text-left rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  + আরবি প্রশ্ন (RTL)
                </button>
              </div>
            </div>

            {/* 💾 সেভ করা প্রশ্নপত্র (Saved Drafts List) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  💾 সেভ করা প্রশ্নপত্র ({savedPapers.length}):
                </label>
                {savedPapers.length > 0 && (
                  <button
                    onClick={clearAllDrafts}
                    className="text-[10px] text-red-600 hover:text-red-700 font-bold"
                  >
                    সব মুছুন
                  </button>
                )}
              </div>

              {savedPapers.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">কোনো ড্রাফট সংরক্ষিত নেই</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {savedPapers.map(paper => (
                    <div
                      key={paper.id}
                      onClick={() => loadDraft(paper)}
                      className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200 truncate">
                          {paper.title}
                        </div>
                        <div className="text-[9.5px] text-slate-400">
                          {toBnNum(paper.total_marks)} নম্বর • {new Date(paper.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className="text-[10px] text-blue-600 font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
                          খুলুন
                        </span>
                        <button
                          onClick={e => deleteDraft(paper.id, e)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                          title="মুছুন"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ================= AUTO GENERATOR MODAL ================= */}
      {showAutoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 font-noto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎲</span>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  অটো প্রশ্ন জেনারেটর
                </h3>
              </div>
              <button
                onClick={() => setShowAutoModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  টার্গেট পূর্ণমান নির্বাচন করুন:
                </label>
                <div className="flex gap-2">
                  {[50, 100].map(m => (
                    <button
                      key={m}
                      onClick={() => setAutoTargetMarks(m)}
                      className={`flex-1 py-1.5 rounded-lg border font-black text-xs transition ${
                        autoTargetMarks === m
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      {toBnNum(m)} নম্বর
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  প্রশ্নের সংখ্যা বিন্যাস:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">MCQ সংখ্যা:</span>
                    <input
                      type="number"
                      min="0"
                      value={autoMcqCount}
                      onChange={e => setAutoMcqCount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs p-1 border rounded bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">শূন্যস্থান পূরণ:</span>
                    <input
                      type="number"
                      min="0"
                      value={autoFillBlankCount}
                      onChange={e => setAutoFillBlankCount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs p-1 border rounded bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">সংক্ষিপ্ত প্রশ্ন:</span>
                    <input
                      type="number"
                      min="0"
                      value={autoShortCount}
                      onChange={e => setAutoShortCount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs p-1 border rounded bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">রচনামূলক প্রশ্ন:</span>
                    <input
                      type="number"
                      min="0"
                      value={autoBroadCount}
                      onChange={e => setAutoBroadCount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs p-1 border rounded bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40 text-blue-800 dark:text-blue-200 text-[11px] leading-relaxed">
                💡 নির্বাচিত পাঠ্যবই থেকে স্বয়ংক্রিয়ভাবে প্রশ্নপত্র তৈরি হবে। তৈরির পর আপনি যেকোনো অংশ এডিট করতে পারবেন।
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowAutoModal(false)}
                className="px-4 py-1.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg text-xs"
              >
                বাতিল
              </button>
              <button
                onClick={executeAutoGenerator}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm"
              >
                তৈরি করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRO PLAN UPGRADE MODAL ================= */}
      {showProModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 dark:border-amber-700/60 font-noto text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Crown size={28} />
            </div>

            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Deenora Pro আনলক করুন
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-1">
              {proModalReason || '৬২,০০০+ পূর্ণ প্রশ্ন সম্ভার ও প্রিন্ট এক্সপোর্ট'}
            </p>

            <div className="my-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-left text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>৬২,০০০+ নূরানী, বেফাক, আলিয়া ও NCTB প্রশ্ন আনলক</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>আনলিমিটেড প্রিন্ট ও হাই-কোয়ালিটি A4 PDF এক্সপোর্ট</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>Microsoft Word (.doc) ফরম্যাটে ১-ক্লিক রূপান্তর</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>শিক্ষক উত্তরপত্র (Answer Key) তৈরি ও ক্লাউড সেভ</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowProModal(false)}
                className="flex-1 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs"
              >
                পরে করব
              </button>
              <button
                onClick={() => {
                  setShowProModal(false);
                  if (onUpgradeClick) {
                    onUpgradeClick();
                  } else {
                    onBack();
                  }
                }}
                className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs shadow-md"
              >
                আপগ্রেড করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 z-50 border border-slate-700 animate-fade-in">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= PRINT CSS RULES ================= */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, aside, .no-print, button, nav, .custom-scrollbar {
            display: none !important;
          }
          main {
            padding: 0 !important;
            background: #fff !important;
            display: block !important;
          }
          #paperSheet {
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            border-color: #000 !important;
          }
          .q-section {
            page-break-inside: avoid;
          }
          @page {
            size: ${paperSize === 'Legal' ? 'legal portrait' : 'A4 portrait'};
            margin: 12mm 15mm;
          }
        }
      `}</style>
    </div>
  );
};
