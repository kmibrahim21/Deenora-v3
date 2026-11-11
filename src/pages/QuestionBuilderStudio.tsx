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
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Download,
  Grid,
  Table,
  FileDown,
  Undo,
  Redo,
  Clipboard,
  Scissors,
  Copy,
  Highlighter,
  List,
  ListOrdered,
  Indent,
  Outdent,
  ArrowUpDown,
  Pilcrow,
  PaintBucket,
  Square
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
  getSupportedBoards,
  getClassesForBoard,
  getQuestionCategories,
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
  const isBn = lang === 'bn';

  // Number localization helper
  const locNum = (n: number | string): string => {
    return isBn ? toBnNum(n) : String(n);
  };

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
  const [mobilePane, setMobilePane] = useState<'paper' | 'library' | 'settings' | 'actions'>('paper');

  // Microsoft Word Menu Tab (ফাইল / হোম / ইনসার্ট / লেআউট / ভিউ)
  const [activeMenuTab, setActiveMenuTab] = useState<'file' | 'home' | 'insert' | 'layout' | 'view'>('home');

  // --- FILTERS STATE (Left Library Pane) ---
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

  // --- PAPER SHEET STATE (Center Canvas) ---
  const [bismillahText, setBismillahText] = useState<string>('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  const [instNameText, setInstNameText] = useState<string>(
    madrasah?.name || (isBn ? 'দারুল উলূম মডেল মাদ্রাসা' : 'Darul Uloom Model Madrasah')
  );
  const [instAddressText, setInstAddressText] = useState<string>(
    madrasah?.address || (isBn ? 'ঢাকা, বাংলাদেশ' : 'Dhaka, Bangladesh')
  );
  const [examTitleText, setExamTitleText] = useState<string>(
    isBn ? 'বার্ষিক পরীক্ষা - ২০২৬' : 'Annual Examination - 2026'
  );
  const [classSubLineText, setClassSubLineText] = useState<string>(
    isBn
      ? 'বিষয়: ইসলাম ও নৈতিক শিক্ষা'
      : 'Subject: Islam & Moral Education'
  );
  const [examTimeText, setExamTimeText] = useState<string>(
    isBn ? '২ ঘণ্টা ৩০ মিনিট' : '2 Hours 30 Minutes'
  );
  const [examMarksText, setExamMarksText] = useState<string>(isBn ? '১০০' : '100');

  // Config toggles & formatting states
  const [showBismillah, setShowBismillah] = useState<boolean>(true);
  const [showStudentInfo, setShowStudentInfo] = useState<boolean>(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState<boolean>(false);
  const [paperSize, setPaperSize] = useState<'A4' | 'Legal'>('A4');
  const [borderStyle, setBorderStyle] = useState<'none' | 'single' | 'double'>('double');
  const [paperMargin, setPaperMargin] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [paperColumns, setPaperColumns] = useState<'1_col' | '2_col'>('2_col');

  // Typography formatting
  const [fontSize, setFontSize] = useState<number>(14);
  const [lineHeight, setLineHeight] = useState<number>(1.5);
  const [questionGap, setQuestionGap] = useState<number>(6);
  const [banglaFont, setBanglaFont] = useState<string>('SolaimanLipi');
  const [arabicFont, setArabicFont] = useState<string>('Amiri');
  const [englishFont, setEnglishFont] = useState<string>('Times New Roman');

  // Word Editor Formatting toggles
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  // Initial Sections (matches uploaded screenshot option 3)
  const defaultExamSections: PaperSection[] = useMemo(() => [
    {
      id: 'sec-1',
      category_type: 'MCQ',
      title: isBn ? '১. সঠিক উত্তরে টিক দাও' : '1. Tick the Correct Answer',
      layout: '2_col',
      numbering_style: 'bangla_number',
      direction: 'ltr',
      dotted_lines: 0,
      marks_formula: isBn ? '১ × ৬ = ৬' : '1 × 6 = 6',
      total_marks: 6,
      questions: [
        {
          id: 'q-1-1',
          category_type: 'MCQ',
          question_text: isBn ? 'আখলাকের মূল শব্দ ______।' : 'The basic word of Akhlaq is ______.',
          marks: 1,
          options: isBn ? ['ভালো', 'মন্দ'] : ['Good', 'Bad']
        },
        {
          id: 'q-1-2',
          category_type: 'MCQ',
          question_text: isBn ? 'বায়েতের ফল অবলম্বন কি?' : 'What is the outcome of Bayah?',
          marks: 1,
          options: isBn ? ['নাজাত', 'কাজ'] : ['Salvation', 'Deed']
        },
        {
          id: 'q-1-3',
          category_type: 'MCQ',
          question_text: isBn ? 'পরিষ্কার কাজ থেকে কি মুছে?' : 'What is erased by good clean deeds?',
          marks: 1,
          options: isBn ? ['গোনাহ', 'ময়লা'] : ['Sins', 'Dirt']
        },
        {
          id: 'q-1-4',
          category_type: 'MCQ',
          question_text: isBn ? 'মাক্কিয় কোন কোনগুলো?' : 'Which ones are Makki Surahs?',
          marks: 1,
          options: isBn ? ['সূরা ফালাক', 'সূরা নাস'] : ['Surah Falaq', 'Surah Nas']
        },
        {
          id: 'q-1-5',
          category_type: 'MCQ',
          question_text: isBn ? 'ব্যবসায়ীদের সৎ হওয়ার পুরস্কার কি?' : 'What is the reward for honest merchants?',
          marks: 1,
          options: isBn ? ['জান্নাত', 'মর্যাদা'] : ['Jannah', 'Dignity']
        },
        {
          id: 'q-1-6',
          category_type: 'MCQ',
          question_text: isBn ? 'বৃষ্টির দিনে আমাদের দোয়া পড়তে হয়?' : 'Which prayer is recited during rain?',
          marks: 1,
          options: isBn ? ['আল্লাহুম্মা সায়্যিবান নাফিআন', 'আলহামদুলিল্লাহ'] : ['Allahumma Sayyiban Nafian', 'Alhamdulillah']
        }
      ]
    },
    {
      id: 'sec-2',
      category_type: 'শূন্যস্থান',
      title: isBn ? '২. শূন্যস্থান পূরণ করো' : '2. Fill in the Blanks',
      layout: '1_col',
      numbering_style: 'bangla_number',
      direction: 'ltr',
      dotted_lines: 0,
      marks_formula: isBn ? '১ × ৬ = ৬' : '1 × 6 = 6',
      total_marks: 6,
      questions: [
        {
          id: 'q-2-1',
          category_type: 'শূন্যস্থান',
          question_text: isBn ? 'জনাব্যের ইসলাম ও নৈতিক শিক্ষা।' : 'Learning Islam & Moral Education.',
          marks: 1
        },
        {
          id: 'q-2-2',
          category_type: 'শূন্যস্থান',
          question_text: isBn ? '____________ ফলাফল প্রকাশ করো।' : '____________ publish results.',
          marks: 1
        },
        {
          id: 'q-2-3',
          category_type: 'শূন্যস্থান',
          question_text: isBn ? 'নিয়মমাফিক সবকগুলো ____________।' : 'Regular lessons should be ____________.',
          marks: 1
        },
        {
          id: 'q-2-4',
          category_type: 'শূন্যস্থান',
          question_text: isBn ? 'আন্তরিকতার সাথে ____________।' : 'With sincerity ____________.',
          marks: 1
        },
        {
          id: 'q-2-5',
          category_type: 'শূন্যস্থান',
          question_text: isBn ? '____________ আগমনপত্র পাঠ করো।' : '____________ recite invitation.',
          marks: 1
        },
        {
          id: 'q-2-6',
          category_type: 'শূন্যস্থান',
          question_text: isBn ? '____________ অভাব দূর করো।' : '____________ fulfill needs.',
          marks: 1
        }
      ]
    }
  ], [isBn]);

  // Sections
  const [sections, setSections] = useState<PaperSection[]>(defaultExamSections);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | null>(null);

  // Responsive Zoom & Viewport tracking
  const [paperZoom, setPaperZoom] = useState<'fit' | 'compact' | '100'>('fit');
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 800);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Localized lists
  const supportedBoardsList = useMemo(() => getSupportedBoards(lang), [lang]);
  const supportedCategoriesList = useMemo(() => getQuestionCategories(lang), [lang]);
  const availableClasses = useMemo(() => getClassesForBoard(selectedBoardId, lang), [selectedBoardId, lang]);

  // Drag and drop tracking
  const dragItem = useRef<{ type: 'section' | 'question'; secIdx: number; qIdx?: number; data?: any } | null>(null);

  // Auto Generator Modal State
  const [showAutoModal, setShowAutoModal] = useState<boolean>(false);
  const [autoTargetMarks, setAutoTargetMarks] = useState<number>(100);
  const [autoMcqCount, setAutoMcqCount] = useState<number>(10);
  const [autoFillBlankCount, setAutoFillBlankCount] = useState<number>(10);
  const [autoShortCount, setAutoShortCount] = useState<number>(10);
  const [autoBroadCount, setAutoBroadCount] = useState<number>(6);
  const [autoArabicCount, setAutoArabicCount] = useState<number>(6);

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
          targetMarks: 100
        }).then(defaultSecs => {
          if (!isCancelled) setSections(defaultSecs);
        });
      }

      // Update paper header subject info
      const currBook = books.find(b => b.id === selectedBookId);
      if (currBook) {
        if (isBn) {
          setClassSubLineText(`শ্রেণি: ${currBook.class_name}  |  বিষয়: ${currBook.title}  |  বোর্ড: ${currBook.board}`);
        } else {
          setClassSubLineText(`Class: ${currBook.class_name}  |  Subject: ${currBook.title}  |  Board: ${currBook.board}`);
        }
      }
    });

    return () => { isCancelled = true; };
  }, [selectedBookId, filteredBooks, books, isBn]);

  // Filter chapters - strictly isolated to books in filteredBooks
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

  // Filter questions for Left Pane
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
      const cat = q.category_type || (isBn ? 'অন্যান্য প্রশ্ন' : 'Other Questions');
      if (!map[cat]) map[cat] = [];
      map[cat].push(q);
    });
    return map;
  }, [filteredQuestions, isBn]);

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

  // Real-time total questions count
  const totalQuestionsCount = useMemo(() => {
    return sections.reduce((sum, sec) => sum + sec.questions.length, 0);
  }, [sections]);

  // Toast feedback helper
  const triggerToast = (msg: string, action?: { label: string; onClick: () => void }) => {
    setToastMessage(msg);
    setToastAction(action || null);
    setTimeout(() => {
      setToastMessage(null);
      setToastAction(null);
    }, 3200);
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
        marks: q.default_marks || 1,
        left_items: q.left_items,
        right_items: q.right_items
      };

      if (!targetSec) {
        const newSec: PaperSection = {
          id: `sec-${Date.now()}`,
          category_type: q.category_type,
          title: isBn ? `${toBnNum(prev.length + 1)}। ${q.category_type}:` : `${prev.length + 1}. ${q.category_type}:`,
          layout: q.options && q.options.length > 0 ? '2_col' : '1_col',
          numbering_style: isBn ? 'bangla_letter' : 'english_number',
          direction: q.category_type.includes('আরবি') || q.category_type.includes('Arabic') ? 'rtl' : 'ltr',
          dotted_lines: 0,
          marks_formula: isBn ? `১ × ১ = ১` : `1 × 1 = 1`,
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
            marks_formula: isBn
              ? `${toBnNum(q.default_marks || 1)} × ${toBnNum(updatedQs.length)} = ${toBnNum(newTotal)}`
              : `${q.default_marks || 1} × ${updatedQs.length} = ${newTotal}`
          };
        }
        return s;
      });
    });

    triggerToast(isBn ? '✓ প্রশ্নপত্রটিতে যোগ হয়েছে' : '✓ Added to question paper', {
      label: isBn ? 'প্রশ্নপত্রে দেখুন ➔' : 'View on Paper ➔',
      onClick: () => setMobilePane('paper')
    });
  };

  // Bulk add from category
  const addRandomFromCategory = (catName: string, count: number) => {
    const list = questionsByCategory[catName] || [];
    if (list.length === 0) return;
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count);
    picked.forEach(q => addQuestionToPaper(q));
    triggerToast(isBn ? `${toBnNum(picked.length)}টি প্রশ্ন যোগ করা হয়েছে` : `Added ${picked.length} questions`);
  };

  // Fast preset quick-section adding
  const addQuickSection = (type: 'short' | 'fill' | 'mcq' | 'matching') => {
    let title = '';
    let category = '';
    let layout: PaperSection['layout'] = '1_col';
    let direction: 'ltr' | 'rtl' = 'ltr';
    let numbering: PaperSection['numbering_style'] = isBn ? 'bangla_letter' : 'english_number';

    const secNum = sections.length + 1;

    switch (type) {
      case 'short':
        title = isBn ? `${toBnNum(secNum)}। সংক্ষেপে উত্তর দাও:` : `${secNum}. Answer the following short questions:`;
        category = isBn ? 'সংক্ষিপ্ত প্রশ্ন' : 'Short Questions';
        layout = '1_col';
        break;
      case 'fill':
        title = isBn ? `${toBnNum(secNum)}। উপযুক্ত শব্দ দিয়ে শূন্যস্থান পূরণ করো:` : `${secNum}. Fill in the blanks with appropriate words:`;
        category = isBn ? 'শূন্যস্থান পূরণ করো' : 'Fill in the Blanks';
        layout = '1_col';
        break;
      case 'mcq':
        title = isBn ? `${toBnNum(secNum)}। সঠিক উত্তরটির পাশে টিক (✔) চিহ্ন দাও:` : `${secNum}. Choose the correct answer:`;
        category = isBn ? 'সঠিক উত্তরটি বেছে নাও (এমসিকিউ)' : 'Multiple Choice Questions';
        layout = '2_col';
        break;
      case 'matching':
        title = isBn ? `${toBnNum(secNum)}। ডান পাশের সাথে বাম পাশ মিল করো:` : `${secNum}. Match the items from left to right:`;
        category = isBn ? 'ডান-বাম মিলকরণ টেবিল' : 'Matching Table';
        layout = '1_col';
        break;
    }

    const defaultQs: PaperQuestion[] = type === 'matching' ? [{
      id: `match-${Date.now()}`,
      category_type: category,
      question_text: isBn ? 'বাম পাশের সাথে ডান পাশ মিলকরণ টেবিল:' : 'Match the items in Column A with Column B:',
      left_items: isBn
        ? ['১. সূর্য পূর্ব দিকে', '২. শিক্ষাই জাতির', '৩. আমাদের মাতৃভাষা', '৪. সততা সর্বোৎকৃষ্ট']
        : ['1. The sun rises in', '2. Education is the backbone of', '3. Our mother language is', '4. Honesty is the best'],
      right_items: isBn
        ? ['মেরুদণ্ড।', 'উঠে থাকে।', 'পন্থা।', 'বাংলা।']
        : ['the east.', 'a nation.', 'Bengali.', 'policy.'],
      marks: 4
    }] : [];

    const newSec: PaperSection = {
      id: `sec-${Date.now()}`,
      category_type: category,
      title,
      layout,
      numbering_style: numbering,
      direction,
      dotted_lines: 0,
      marks_formula: isBn ? (type === 'matching' ? '১ × ৪ = ৪' : '১ × ৫ = ৫') : (type === 'matching' ? '1 × 4 = 4' : '1 × 5 = 5'),
      total_marks: type === 'matching' ? 4 : 5,
      questions: defaultQs
    };

    setSections(prev => [...prev, newSec]);
    triggerToast(isBn ? `"${category}" বিভাগ যুক্ত হয়েছে` : `"${category}" section added`);
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
    triggerToast(isBn ? 'বিভাগ মুছে ফেলা হয়েছে' : 'Section deleted');
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
      category_type: isBn ? 'কাস্টম' : 'Custom',
      question_text: isBn ? 'নতুন প্রশ্নের বিবরণ এখানে ক্লিক করে লিখুন...' : 'Click here to write question text...',
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

  // Save current paper draft
  const saveCurrentDraft = async () => {
    setIsSaving(true);
    const paperObj: QBSavedPaper = {
      id: `paper-${Date.now()}`,
      madrasa_id: madrasah?.id,
      title: `${examTitleText} - ${classSubLineText}`,
      exam_name: examTitleText,
      class_name: classSubLineText,
      subject_name: classSubLineText,
      total_marks: totalCalculatedMarks,
      time_duration: examTimeText,
      paper_config: {
        bismillah_type: showBismillah ? 'arabic' : 'none',
        madrasah_name: instNameText,
        madrasah_address: instAddressText,
        exam_title: examTitleText,
        class_name: classSubLineText,
        subject_name: classSubLineText,
        subject_code: '',
        time_duration: examTimeText,
        target_marks: totalCalculatedMarks,
        show_student_info_box: showStudentInfo,
        show_instructions: false,
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

    const res = await QuestionBankService.savePaper(paperObj, madrasah?.id);
    setIsSaving(false);
    if (res.success) {
      setSavedPapers(prev => [paperObj, ...prev.filter(p => p.id !== paperObj.id)]);
      triggerToast(isBn ? '✓ প্রশ্নপত্র ক্লাউডে সংরক্ষিত হয়েছে!' : '✓ Question paper saved to cloud!');
    }
  };

  // Print / PDF Export
  const printPaper = () => {
    if (!hasActiveSubscription) {
      setProModalReason(isBn ? 'প্রিন্ট ও PDF ডাউনলোডের জন্য প্রিমিয়াম প্ল্যানে আপগ্রেড করুন' : 'Upgrade to premium plan for Print and PDF download');
      setShowProModal(true);
      return;
    }
    window.print();
  };

  // Export to Microsoft Word (.doc) Logic with Full Styling & UTF-8 Encoding
  const exportToWordDoc = () => {
    if (!hasActiveSubscription) {
      setProModalReason(isBn ? 'MS Word (.doc) ফরম্যাটে ডাউনলোডের জন্য প্রিমিয়াম প্ল্যানে আপগ্রেড করুন' : 'Upgrade to premium plan for MS Word (.doc) export');
      setShowProModal(true);
      return;
    }

    const paperElement = document.getElementById('paperSheet');
    if (!paperElement) {
      alert(isBn ? 'প্রশ্নপত্রের কনটেন্ট পাওয়া যায়নি' : 'Question paper content not found');
      return;
    }

    const contentHtml = paperElement.innerHTML;
    const wordDocumentHtml = `
      <!DOCTYPE html>
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${examTitleText || (isBn ? 'প্রশ্নপত্র' : 'Question Paper')}</title>
        <style>
          @page {
            size: ${paperSize === 'Legal' ? '8.5in 14in' : '8.27in 11.69in'};
            margin: ${paperMargin === 'narrow' ? '0.35in 0.35in 0.35in 0.35in' : paperMargin === 'wide' ? '0.85in 0.85in 0.85in 0.85in' : '0.6in 0.6in 0.6in 0.6in'};
          }
          body {
            font-family: '${banglaFont}', 'SolaimanLipi', 'Kalpurush', 'Times New Roman', serif;
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            color: #000;
          }
          .header-center { text-align: center; }
          .border-box { border: ${borderStyle === 'double' ? '3px double #000' : borderStyle === 'single' ? '1px solid #000' : 'none'}; padding: 15px; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 4px; }
          .write-line { border-bottom: 1px dotted #888; height: 16px; margin: 4px 0; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        <div class="border-box">
          ${contentHtml}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + wordDocumentHtml], {
      type: 'application/msword;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${(examTitleText || 'Question_Paper').replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    triggerToast(isBn ? 'Microsoft Word (.doc) ফাইল সফলভাবে প্রস্তুত হয়েছে!' : 'Microsoft Word (.doc) file successfully generated!');
  };

  // Run Auto Generator
  const executeAutoGenerator = async () => {
    if (!selectedBookId || selectedBookId === 'all') {
      alert(isBn ? 'অনুগ্রহ করে প্রথমে একটি পাঠ্যবই নির্বাচন করুন' : 'Please select a book first');
      return;
    }

    const generated = await QuestionBankService.autoGenerateExam({
      bookId: selectedBookId,
      chapterIds: selectedChapterId === 'all' ? undefined : [selectedChapterId],
      mcqCount: autoMcqCount,
      fillBlankCount: autoFillBlankCount,
      shortCount: autoShortCount,
      broadCount: autoBroadCount,
      arabicCount: autoArabicCount,
      targetMarks: autoTargetMarks
    });

    setSections(generated);
    setExamMarksText(locNum(autoTargetMarks));
    setShowAutoModal(false);
    triggerToast(isBn ? 'সম্পূর্ণ প্রশ্নপত্র অটোমেটিক তৈরি হয়েছে!' : 'Complete question paper generated automatically!');
  };

  // Load a saved draft
  const loadDraft = (paper: QBSavedPaper) => {
    setSections(paper.sections_data);
    setInstNameText(paper.paper_config.madrasah_name || instNameText);
    setInstAddressText(paper.paper_config.madrasah_address || instAddressText);
    setExamTitleText(paper.exam_name || examTitleText);
    setClassSubLineText(paper.paper_config.class_name || classSubLineText);
    setExamTimeText(paper.time_duration || examTimeText);
    setExamMarksText(locNum(paper.total_marks || 100));
    if (paper.paper_config.font_size) setFontSize(paper.paper_config.font_size);
    if (paper.paper_config.line_height) setLineHeight(paper.paper_config.line_height);
    if (paper.paper_config.bangla_font) setBanglaFont(paper.paper_config.bangla_font);
    if (paper.paper_config.arabic_font) setArabicFont(paper.paper_config.arabic_font);
    if (paper.paper_config.border_style) setBorderStyle(paper.paper_config.border_style);
    triggerToast(isBn ? `"${paper.title}" লোড করা হয়েছে` : `"${paper.title}" loaded`);
    setMobilePane('paper');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-[#f1f5f9] dark:bg-[#090d16] font-noto overflow-hidden select-none">
      
      {/* ================= OPTION 3: CLASSIC MADRASAH MS WORD UI - 2-ROW RIBBON ================= */}
      <header className="bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-800 z-30 shrink-0 shadow-xs">
        
        {/* ================= TOP TITLE BAR: WINDOWS & WORD QUICK ACCESS ================= */}
        <div className="h-8 bg-[#2b579a] text-white flex items-center justify-between px-3 text-xs select-none border-b border-[#1f4277]">
          {/* Left: Word Icon, Save, Undo, Redo, Customize */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-[#1e3e6f] flex items-center justify-center font-black text-white text-[11px] shadow-xs select-none">
              W
            </div>
            <button
              type="button"
              onClick={saveCurrentDraft}
              title={isBn ? 'সংরক্ষণ (Ctrl+S)' : 'Save (Ctrl+S)'}
              className="p-1 hover:bg-white/20 rounded transition text-white/90"
            >
              <Save size={13} />
            </button>
            <button
              type="button"
              onClick={() => triggerToast(isBn ? 'পূর্বাবস্থায় ফিরে যাওয়া হয়েছে' : 'Undo applied')}
              title={isBn ? 'পূর্বাবস্থায় ফিরুন (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
              className="p-1 hover:bg-white/20 rounded transition text-white/90"
            >
              <Undo size={13} />
            </button>
            <button
              type="button"
              onClick={() => triggerToast(isBn ? 'পুনরায় করা হয়েছে' : 'Redo applied')}
              title={isBn ? 'পুনরায় করুন (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
              className="p-1 hover:bg-white/20 rounded transition text-white/90"
            >
              <Redo size={13} />
            </button>
            <div className="h-3.5 w-[1px] bg-white/25 mx-0.5" />
            <button
              type="button"
              title={isBn ? 'কুইক অ্যাক্সেস কাস্টমাইজ' : 'Customize Quick Access'}
              className="p-0.5 hover:bg-white/20 rounded transition text-white/80"
            >
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Center: Title */}
          <div className="font-semibold text-xs tracking-wide text-white/95 truncate">
            Deenora Question Maker
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center">
            <button
              type="button"
              title={isBn ? 'মিনিমাইজ' : 'Minimize'}
              className="w-8 h-6 flex items-center justify-center hover:bg-white/20 text-xs transition text-white/80"
            >
              —
            </button>
            <button
              type="button"
              title={isBn ? 'ম্যাক্সিমাইজ' : 'Maximize'}
              className="w-8 h-6 flex items-center justify-center hover:bg-white/20 text-xs transition text-white/80"
            >
              □
            </button>
            <button
              type="button"
              onClick={onBack}
              title={isBn ? 'বন্ধ করুন ও ফিরে যান' : 'Close and Exit'}
              className="w-8 h-6 flex items-center justify-center hover:bg-red-600 text-xs font-bold transition text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ================= ROW 1: শীর্ষ মেনু ও প্রধান অ্যাকশন বাটন ================= */}
        <div className="h-9 px-3 bg-[#2b579a] flex items-center justify-between border-t border-blue-400/20">
          
          {/* Menu Tabs: [ফাইল] [হোম] [ইনসার্ট] [পেজ লেআউট] [ভিউ] */}
          <div className="flex items-end gap-1 h-full pt-1">
            <button
              type="button"
              onClick={() => setActiveMenuTab('file')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition ${
                activeMenuTab === 'file'
                  ? 'bg-[#f3f2f1] dark:bg-slate-800 text-[#2b579a] dark:text-blue-400 shadow-xs'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              {isBn ? 'ফাইল' : 'File'}
            </button>

            <button
              type="button"
              onClick={() => setActiveMenuTab('home')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition ${
                activeMenuTab === 'home'
                  ? 'bg-[#f3f2f1] dark:bg-slate-800 text-[#2b579a] dark:text-blue-400 shadow-xs'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              {isBn ? 'হোম' : 'Home'}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenuTab('insert');
                setMobilePane('library');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition ${
                activeMenuTab === 'insert'
                  ? 'bg-[#f3f2f1] dark:bg-slate-800 text-[#2b579a] dark:text-blue-400 shadow-xs'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              {isBn ? 'ইনসার্ট' : 'Insert'}
            </button>

            <button
              type="button"
              onClick={() => setActiveMenuTab('layout')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition ${
                activeMenuTab === 'layout'
                  ? 'bg-[#f3f2f1] dark:bg-slate-800 text-[#2b579a] dark:text-blue-400 shadow-xs'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              {isBn ? 'পেজ লেআউট' : 'Page Layout'}
            </button>

            <button
              type="button"
              onClick={() => setActiveMenuTab('view')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition ${
                activeMenuTab === 'view'
                  ? 'bg-[#f3f2f1] dark:bg-slate-800 text-[#2b579a] dark:text-blue-400 shadow-xs'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              {isBn ? 'ভিউ' : 'View'}
            </button>
          </div>

          {/* Right Side: Primary Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 1. 💾 ড্রাফট সংরক্ষণ / Save Draft */}
            <button
              type="button"
              onClick={saveCurrentDraft}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold border border-white/20 transition active:scale-95"
              title={isBn ? 'ড্রাফট ক্লাউডে সংরক্ষণ করুন' : 'Save draft to cloud'}
            >
              <Save size={13} className="shrink-0" />
              <span className="hidden sm:inline">{isBn ? 'ড্রাফট সংরক্ষণ' : 'Save Draft'}</span>
            </button>

            {/* 2. 📥 ওয়ার্ড ডাউনলোড (.doc) / Download Word (.doc) */}
            <button
              type="button"
              onClick={exportToWordDoc}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold border border-white/20 transition active:scale-95"
              title={isBn ? 'Microsoft Word (.doc) ফাইল ডাউনলোড' : 'Download Microsoft Word (.doc) file'}
            >
              <FileDown size={13} className="shrink-0" />
              <span className="hidden md:inline">{isBn ? 'ওয়ার্ড ডাউনলোড (.doc)' : 'Download Word (.doc)'}</span>
              <span className="md:hidden">Word</span>
            </button>

            {/* 3. 🖨️ প্রিন্ট করুন / Print */}
            <button
              type="button"
              onClick={printPaper}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold border border-white/20 transition active:scale-95"
              title={isBn ? 'প্রিন্ট অথবা PDF হিসেবে সংরক্ষণ' : 'Print or save as PDF'}
            >
              <Printer size={13} className="shrink-0" />
              <span className="hidden sm:inline">{isBn ? 'প্রিন্ট করুন' : 'Print'}</span>
            </button>

            {/* 4. 🪄 ১-ক্লিক প্রশ্ন তৈরি / 1-Click Auto Paper (Distinct Emerald Button) */}
            <button
              type="button"
              onClick={() => setShowAutoModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#107c41] hover:bg-[#0e6b37] text-white rounded text-xs font-black shadow-md transition active:scale-95 border border-emerald-400/40"
              title={isBn ? '১-ক্লিকে ৫০ বা ১০০ নম্বরের অটো প্রশ্নপত্র তৈরি' : '1-Click auto generate full 50 or 100 mark paper'}
            >
              <Sparkles size={13} className="shrink-0 text-amber-300" />
              <span>{isBn ? '১-ক্লিক প্রশ্ন তৈরি' : '1-Click Auto Paper'}</span>
            </button>
          </div>
        </div>

        {/* ================= ROW 2: টুলবার ও ফরম্যাটিং রিবন (5 Distinct Word Groups with Bottom Labels) ================= */}
        <div className="h-[84px] px-3 py-1 bg-[#f3f2f1] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-stretch gap-1 overflow-x-auto scrollbar-none text-xs select-none">
          
          {/* গ্রুপ ১: ক্লিপবোর্ড (Clipboard Group) */}
          <div className="flex flex-col justify-between px-2 py-0.5 border-r border-slate-300 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              {/* Big Paste Button */}
              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'টেক্সট পেস্ট করতে কার্সর রেখে Ctrl+V চাপুন' : 'Click in text and press Ctrl+V to paste')}
                className="flex flex-col items-center justify-center px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-300 transition group"
                title={isBn ? 'পেস্ট' : 'Paste'}
              >
                <Clipboard size={18} className="text-[#2b579a] dark:text-blue-400 group-hover:scale-105 transition" />
                <span className="text-[10px] font-bold mt-0.5 text-slate-700 dark:text-slate-300">
                  {isBn ? 'পেস্ট' : 'Paste'}
                </span>
              </button>

              {/* Stacked Cut & Copy */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => triggerToast(isBn ? 'কাট করতে লেখা সিলেক্ট করে Ctrl+X চাপুন' : 'Select text and press Ctrl+X to cut')}
                  className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[10px]"
                  title={isBn ? 'কাট (Ctrl+X)' : 'Cut (Ctrl+X)'}
                >
                  <Scissors size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => triggerToast(isBn ? 'কপি করতে লেখা সিলেক্ট করে Ctrl+C চাপুন' : 'Select text and press Ctrl+C to copy')}
                  className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[10px]"
                  title={isBn ? 'কপি (Ctrl+C)' : 'Copy (Ctrl+C)'}
                >
                  <Copy size={11} />
                </button>
              </div>
            </div>
            <div className="text-[10px] text-center text-slate-500 font-bold tracking-tight">
              {isBn ? 'ক্লিপবোর্ড' : 'Clipboard'}
            </div>
          </div>

          {/* গ্রুপ ২: ফন্ট (Font Group) */}
          <div className="flex flex-col justify-between px-2.5 py-0.5 border-r border-slate-300 dark:border-slate-700 shrink-0">
            {/* Line 1: Font dropdown, size dropdown, A^, Av */}
            <div className="flex items-center gap-1">
              <select
                value={banglaFont}
                onChange={e => setBanglaFont(e.target.value)}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-200 h-6"
                title={isBn ? 'ফন্ট নির্বাচন' : 'Font Family'}
              >
                <option value="SolaimanLipi">{isBn ? 'ফন্ট: সোলায়মান লিপি' : 'Font: SolaimanLipi'}</option>
                <option value="Kalpurush">{isBn ? 'কালপুরুষ' : 'Kalpurush'}</option>
                <option value="Noto Serif Bengali">{isBn ? 'নোটো সেরিফ বাংলা' : 'Noto Serif Bengali'}</option>
                <option value="Amiri">{isBn ? 'আমিরি (আরবি/উর্দু)' : 'Amiri (Arabic/Urdu)'}</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
              </select>

              <select
                value={Math.round(fontSize)}
                onChange={e => setFontSize(parseInt(e.target.value) || 14)}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 h-6"
                title={isBn ? 'সাইজ নির্বাচন' : 'Font Size'}
              >
                {[11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map(sz => (
                  <option key={sz} value={sz}>{isBn ? `সাইজ: ${locNum(sz)}` : `Size: ${sz}`}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setFontSize(prev => Math.min(26, prev + 1))}
                className="h-6 px-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 font-bold text-[11px] flex items-center"
                title={isBn ? 'ফন্ট বড় করুন' : 'Increase Font'}
              >
                <span className="text-xs">A</span>
                <ChevronUp size={10} className="-ml-0.5" />
              </button>

              <button
                type="button"
                onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
                className="h-6 px-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 font-bold text-[11px] flex items-center"
                title={isBn ? 'ফন্ট ছোট করুন' : 'Decrease Font'}
              >
                <span className="text-xs">A</span>
                <ChevronDown size={10} className="-ml-0.5" />
              </button>
            </div>

            {/* Line 2: Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Highlight, Font Color */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setIsBold(!isBold)}
                className={`w-6 h-5 flex items-center justify-center rounded text-xs font-black transition ${
                  isBold ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'বোল্ড (Ctrl+B)' : 'Bold (Ctrl+B)'}
              >
                B
              </button>

              <button
                type="button"
                onClick={() => setIsItalic(!isItalic)}
                className={`w-6 h-5 flex items-center justify-center rounded text-xs italic font-serif transition ${
                  isItalic ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'ইটালিক (Ctrl+I)' : 'Italic (Ctrl+I)'}
              >
                I
              </button>

              <button
                type="button"
                onClick={() => setIsUnderline(!isUnderline)}
                className={`w-6 h-5 flex items-center justify-center rounded text-xs underline transition ${
                  isUnderline ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'আন্ডারলাইন (Ctrl+U)' : 'Underline (Ctrl+U)'}
              >
                U
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'স্ট্রাইকথ্রু মোড' : 'Strikethrough')}
                className="w-6 h-5 flex items-center justify-center rounded text-xs line-through text-slate-700 dark:text-slate-300 hover:bg-white"
                title={isBn ? 'স্ট্রাইকথ্রু' : 'Strikethrough'}
              >
                abc
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'সাবস্ক্রিপ্ট' : 'Subscript')}
                className="w-6 h-5 flex items-center justify-center rounded text-[10px] text-slate-700 dark:text-slate-300 hover:bg-white"
                title={isBn ? 'সাবস্ক্রিপ্ট' : 'Subscript'}
              >
                x₂
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'সুপারস্ক্রিপ্ট' : 'Superscript')}
                className="w-6 h-5 flex items-center justify-center rounded text-[10px] text-slate-700 dark:text-slate-300 hover:bg-white"
                title={isBn ? 'সুপারস্ক্রিপ্ট' : 'Superscript'}
              >
                x²
              </button>

              <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5" />

              {/* Highlighter Icon */}
              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'হাইলাইটার' : 'Highlighter')}
                className="w-6 h-5 flex items-center justify-center rounded text-amber-500 hover:bg-white"
                title={isBn ? 'হাইলাইট কালার' : 'Highlight Color'}
              >
                <Highlighter size={12} />
              </button>

              {/* Font Color Icon with Red Bar */}
              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'ফন্ট কালার' : 'Font Color')}
                className="w-6 h-5 flex flex-col items-center justify-center rounded hover:bg-white"
                title={isBn ? 'ফন্ট কালার' : 'Font Color'}
              >
                <span className="text-[11px] font-black leading-none">A</span>
                <div className="w-3.5 h-[2px] bg-red-600 rounded-full mt-0.5" />
              </button>
            </div>

            <div className="text-[10px] text-center text-slate-500 font-bold tracking-tight">
              {isBn ? 'ফন্ট' : 'Font'}
            </div>
          </div>

          {/* গ্রুপ ৩: প্যারাগ্রাফ (Paragraph Group) */}
          <div className="flex flex-col justify-between px-2.5 py-0.5 border-r border-slate-300 dark:border-slate-700 shrink-0">
            {/* Line 1: Bullets, Numbering, Indent, Paragraph Symbol */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'বুলেট তালিকা' : 'Bullet List')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'বুলেট লিস্ট' : 'Bullet List'}
              >
                <List size={12} />
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'সংখ্যা ক্রম তালিকা' : 'Numbered List')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'নম্বর লিস্ট' : 'Number List'}
              >
                <ListOrdered size={12} />
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'ইন্ডেন্ট কমানো হয়েছে' : 'Decreased Indent')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'ইন্ডেন্ট কমান' : 'Decrease Indent'}
              >
                <Outdent size={12} />
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'ইন্ডেন্ট বাড়ানো হয়েছে' : 'Increased Indent')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'ইন্ডেন্ট বাড়ান' : 'Increase Indent'}
              >
                <Indent size={12} />
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'সর্টিং মোড' : 'Sort')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'সর্ট করুন' : 'Sort'}
              >
                <ArrowUpDown size={12} />
              </button>

              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'প্যারাগ্রাফ চিহ্ন টগল' : 'Paragraph Marks')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'প্যারাগ্রাফ মার্কস' : 'Paragraph Marks'}
              >
                <Pilcrow size={12} />
              </button>
            </div>

            {/* Line 2: Align Left, Center, Right, Justify, Spacing, Shading, Borders */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setTextAlign('left')}
                className={`w-6 h-5 flex items-center justify-center rounded transition ${
                  textAlign === 'left' ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'বাম প্রান্ত সমান' : 'Align Left'}
              >
                <AlignLeft size={12} />
              </button>

              <button
                type="button"
                onClick={() => setTextAlign('center')}
                className={`w-6 h-5 flex items-center justify-center rounded transition ${
                  textAlign === 'center' ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'মাঝখানে সাজান' : 'Center'}
              >
                <AlignCenter size={12} />
              </button>

              <button
                type="button"
                onClick={() => setTextAlign('right')}
                className={`w-6 h-5 flex items-center justify-center rounded transition ${
                  textAlign === 'right' ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'ডান প্রান্ত সমান' : 'Align Right'}
              >
                <AlignRight size={12} />
              </button>

              <button
                type="button"
                onClick={() => setTextAlign('justify')}
                className={`w-6 h-5 flex items-center justify-center rounded transition ${
                  textAlign === 'justify' ? 'bg-[#2b579a] text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:bg-white'
                }`}
                title={isBn ? 'উভয়পাশ সমান (জাস্টিফাই)' : 'Justify'}
              >
                <AlignJustify size={12} />
              </button>

              {/* Line Spacing */}
              <select
                value={lineHeight}
                onChange={e => setLineHeight(parseFloat(e.target.value) || 1.5)}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 h-5 ml-1"
                title={isBn ? 'লাইন স্পেসিং' : 'Line Spacing'}
              >
                <option value="1.15">{locNum('1.15')}</option>
                <option value="1.25">{locNum('1.25')}</option>
                <option value="1.5">{locNum('1.50')}</option>
                <option value="2.0">{locNum('2.00')}</option>
              </select>

              {/* Shading Bucket */}
              <button
                type="button"
                onClick={() => triggerToast(isBn ? 'শেডিং কালার' : 'Shading')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'শেডিং কালার' : 'Shading'}
              >
                <PaintBucket size={12} />
              </button>

              {/* Border Square */}
              <button
                type="button"
                onClick={() => setBorderStyle(prev => prev === 'double' ? 'single' : prev === 'single' ? 'none' : 'double')}
                className="p-1 rounded hover:bg-white text-slate-700 dark:text-slate-300"
                title={isBn ? 'বর্ডারস টগল' : 'Borders Toggle'}
              >
                <Square size={12} />
              </button>
            </div>

            <div className="text-[10px] text-center text-slate-500 font-bold tracking-tight">
              {isBn ? 'প্যারাগ্রাফ' : 'Paragraph'}
            </div>
          </div>

          {/* গ্রুপ ৪: লেআউট (Layout Group) */}
          <div className="flex flex-col justify-between px-2.5 py-0.5 border-r border-slate-300 dark:border-slate-700 shrink-0">
            {/* Line 1: Columns Toggle, Page Size */}
            <div className="flex items-center gap-1.5">
              {/* 1-Col vs 2-Col Button */}
              <button
                type="button"
                onClick={() => setPaperColumns(paperColumns === '1_col' ? '2_col' : '1_col')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold transition h-6 ${
                  paperColumns === '2_col'
                    ? 'bg-[#2b579a] text-white border-[#2b579a]'
                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title={isBn ? '১-কলাম বা ২-কলাম টগল করুন' : 'Toggle 1-Column or 2-Columns'}
              >
                <Columns size={12} />
                <span>{paperColumns === '2_col' ? (isBn ? '২-কলাম' : '2-Col') : (isBn ? '১-কলাম' : '1-Col')}</span>
              </button>

              {/* Page Size Select */}
              <select
                value={paperSize}
                onChange={e => setPaperSize(e.target.value as 'A4' | 'Legal')}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 h-6"
                title={isBn ? 'কাগজের সাইজ নির্বাচন' : 'Paper Size'}
              >
                <option value="A4">{isBn ? 'সাইজ: A4' : 'Size: A4'}</option>
                <option value="Legal">{isBn ? 'সাইজ: Legal' : 'Size: Legal'}</option>
              </select>
            </div>

            {/* Line 2: Frame Border Dropdown */}
            <div className="flex items-center gap-1">
              <select
                value={borderStyle}
                onChange={e => setBorderStyle(e.target.value as any)}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 h-6"
                title={isBn ? 'বর্ডার ফ্রেম নির্বাচন' : 'Border Frame'}
              >
                <option value="double">{isBn ? 'বর্ডার: ডাবল ফ্রেম' : 'Border: Double Frame'}</option>
                <option value="single">{isBn ? 'বর্ডার: সিঙ্গেল বর্ডার' : 'Border: Single Solid'}</option>
                <option value="none">{isBn ? 'বর্ডার: বর্ডার নেই' : 'Border: No Border'}</option>
              </select>
            </div>

            <div className="text-[10px] text-center text-slate-500 font-bold tracking-tight">
              {isBn ? 'লেআউট' : 'Layout'}
            </div>
          </div>

          {/* গ্রুপ ৫: ইনসার্ট (Insert Group) */}
          <div className="flex flex-col justify-between px-2.5 py-0.5 shrink-0">
            {/* Line 1: Question Bank (385 Books) Button */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMobilePane('library')}
                className="flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-[#2b579a] dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded text-xs font-black hover:bg-blue-100 transition h-6"
                title={isBn ? '৩৮৫টি বইয়ের প্রশ্ন সম্ভার ওপেন করুন' : 'Open Question Bank Library'}
              >
                <BookOpen size={13} className="text-[#2b579a] dark:text-blue-400" />
                <span>{isBn ? 'প্রশ্নব্যাংক থেকে যোগ (৩৮৫ বই)' : 'Add from Question Bank (385 Books)'}</span>
              </button>
            </div>

            {/* Line 2: New Section & Matching Table */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => addQuickSection('short')}
                className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-700 hover:bg-slate-50 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded text-[11px] font-bold h-6"
                title={isBn ? 'নতুন ক-বিভাগ বা সেকশন তৈরি' : 'Add New Section'}
              >
                <Plus size={12} className="text-emerald-600" />
                <span>{isBn ? 'ক-বিভাগ / নতুন বিভাগ' : 'New Section'}</span>
              </button>

              <button
                type="button"
                onClick={() => addQuickSection('matching')}
                className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[11px] font-bold h-6 hover:bg-indigo-100"
                title={isBn ? 'মিলকরণ টেবিল ইনসার্ট করুন' : 'Insert Matching Table'}
              >
                <Table size={12} />
                <span>{isBn ? 'মিলকরণ টেবিল' : 'Matching Table'}</span>
              </button>
            </div>

            <div className="text-[10px] text-center text-slate-500 font-bold tracking-tight">
              {isBn ? 'ইনসার্ট' : 'Insert'}
            </div>
          </div>

        </div>
      </header>

      {/* ================= 3-PANE WORKSPACE ================= */}
      <div className="flex-1 flex overflow-hidden relative pb-14 md:pb-0">

        {/* ================= LEFT PANE: 385 BOOKS QUESTION BANK (w-[380px]) ================= */}
        <aside
          className={`w-full md:w-[380px] bg-white dark:bg-[#111827] border-r border-slate-300 dark:border-slate-800 flex flex-col shrink-0 z-20 ${
            mobilePane === 'library' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📚</span>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
                {isBn ? '৩৮৫টি বইয়ের প্রশ্ন সম্ভার' : '385 Books Question Bank'}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              {locNum(filteredQuestions.length)} {isBn ? 'টি প্রশ্ন' : 'Questions'}
            </span>
          </div>

          {/* Cascading Filter Dropdowns */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-[#111827]">
            {/* 1. Board Selector */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                {isBn ? '১. বোর্ড নির্বাচন করুন:' : '1. Select Board:'}
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
                {supportedBoardsList.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Class Selector */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                {isBn ? '২. শ্রেণি নির্বাচন করুন:' : '2. Select Class:'}
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
                <option value="all">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 3. Book Selector */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                {isBn ? `৩. বিষয় / পাঠ্যবই (${locNum(filteredBooks.length)}টি):` : `3. Subject / Book (${filteredBooks.length}):`}
              </label>
              <select
                value={selectedBookId}
                onChange={e => {
                  setSelectedBookId(e.target.value);
                  setSelectedChapterId('all');
                }}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 truncate"
              >
                <option value="all">{isBn ? `সকল বই (${locNum(filteredBooks.length)})` : `All Books (${filteredBooks.length})`}</option>
                {filteredBooks.map(b => (
                  <option key={b.id} value={b.id}>{b.title} ({b.class_name})</option>
                ))}
              </select>
            </div>

            {/* 4. Chapter & 5. Category */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isBn ? '৪. অধ্যায়:' : '4. Chapter:'}
                </label>
                <select
                  value={selectedChapterId}
                  onChange={e => setSelectedChapterId(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 truncate"
                >
                  <option value="all">{isBn ? `সকল অধ্যায় (${locNum(filteredChapters.length)})` : `All Chapters (${filteredChapters.length})`}</option>
                  {filteredChapters.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isBn ? '৫. প্রশ্নের ধরন:' : '5. Type:'}
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-1.5 text-slate-800 dark:text-slate-100 truncate"
                >
                  {supportedCategoriesList.map(cat => (
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
                placeholder={isBn ? 'প্রশ্ন বা উত্তর খুঁজুন...' : 'Search questions or answers...'}
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
                <span className="text-xs">{isBn ? '৩৮৫টি বইয়ের প্রশ্ন সম্ভার লোড হচ্ছে...' : 'Loading 385 books question bank...'}</span>
              </div>
            ) : Object.keys(questionsByCategory).length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <AlertCircle size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold">{isBn ? 'কোনো প্রশ্ন পাওয়া যায়নি' : 'No questions found'}</p>
                <p className="text-[11px] text-slate-400 mt-1">{isBn ? 'ফিল্টার পরিবর্তন করে অনুসন্ধান করুন' : 'Change filters and search again'}</p>
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
                          {locNum(qList.length)}
                        </span>
                      </button>

                      {/* Bulk Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => addRandomFromCategory(catName, 5)}
                          className="px-2 py-0.5 text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition"
                          title={isBn ? 'এই ক্যাটাগরি থেকে ৫টি র্যান্ডম প্রশ্ন যোগ করুন' : 'Add 5 questions from this category'}
                        >
                          {isBn ? '+৫টি' : '+5 Qs'}
                        </button>
                        <button
                          onClick={() => addRandomFromCategory(catName, 999)}
                          className="px-2 py-0.5 text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition"
                          title={isBn ? 'এই ক্যাটাগরির সবগুলো প্রশ্ন যোগ করুন' : 'Add all questions from this category'}
                        >
                          {isBn ? '+সব' : '+All'}
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
                                  {locNum(q.default_marks)} {isBn ? 'নম্বর' : 'Marks'}
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
                                      <span>{isBn ? 'যুক্ত' : 'Added'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus size={11} />
                                      <span>{isBn ? 'যোগ' : 'Add'}</span>
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
                                      {getNumberingLabel(i, isBn ? 'bangla_letter' : 'english_letter')} {opt}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Matching table preview */}
                              {q.left_items && q.right_items && (
                                <div className="mt-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded text-[10.5px] space-y-0.5">
                                  <div className="font-bold text-slate-700 dark:text-slate-300 border-b pb-0.5">
                                    {isBn ? 'মিলকরণ টেবিল:' : 'Matching Table:'}
                                  </div>
                                  {q.left_items.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>{item}</span>
                                      <span>➔ {q.right_items?.[idx]}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Answer preview */}
                              {q.answer_text && (
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic mt-1 font-medium truncate">
                                  {isBn ? 'উত্তর:' : 'Answer:'} {q.answer_text}
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
                  {isBn ? 'ফ্রি প্রিভিউ মোড' : 'Free Preview Mode'}
                </h5>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                  {isBn
                    ? 'অধ্যায় প্রতি প্রথম ৫টি প্রশ্ন প্রদর্শিত হচ্ছে। ৩৮৫টি বইয়ের পূর্ণ প্রশ্ন সম্ভার আনলক করতে আপগ্রেড করুন।'
                    : 'Showing first 5 questions per chapter. Upgrade to unlock full 385 books catalog.'}
                </p>
                <button
                  onClick={() => {
                    setProModalReason(isBn ? '৩৮৫টি বইয়ের পূর্ণ প্রশ্ন সম্ভার আনলক করতে আপগ্রেড করুন' : 'Upgrade to unlock full 385 books catalog');
                    setShowProModal(true);
                  }}
                  className="mt-2 w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {isBn ? 'আপগ্রেড করুন' : 'Upgrade Now'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ================= CENTER CANVAS: WORD A4 / LEGAL DOCUMENT CANVAS ================= */}
        <main
          className={`flex-1 overflow-y-auto p-2 sm:p-4 md:p-8 flex flex-col items-center bg-slate-200 dark:bg-slate-900 custom-scrollbar ${
            mobilePane === 'paper' ? 'flex' : 'hidden md:flex'
          }`}
          onDragOver={e => e.preventDefault()}
        >
          {/* Mobile Viewport Scale & Action Bar */}
          <div className="md:hidden w-full max-w-md mb-2 flex items-center justify-between gap-1.5 no-print">
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg p-0.5 border border-slate-300 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={() => setPaperZoom('fit')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition ${
                  paperZoom === 'fit'
                    ? 'bg-[#2b579a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isBn ? 'ফিট' : 'Fit'}
              </button>
              <button
                type="button"
                onClick={() => setPaperZoom('compact')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition ${
                  paperZoom === 'compact'
                    ? 'bg-[#2b579a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isBn ? 'কমপ্যাক্ট' : 'Compact'}
              </button>
              <button
                type="button"
                onClick={() => setPaperZoom('100')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition ${
                  paperZoom === '100'
                    ? 'bg-[#2b579a] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {locNum(100)}%
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                {isBn ? 'মোট:' : 'Total:'} {locNum(totalCalculatedMarks)}
              </span>
              <button
                type="button"
                onClick={exportToWordDoc}
                className="px-2.5 py-1 bg-[#2b579a] hover:bg-[#20447c] text-white text-[11px] font-black rounded-lg shadow-xs flex items-center gap-1 active:scale-95"
              >
                <FileDown size={12} />
                <span>Word</span>
              </button>
              <button
                type="button"
                onClick={printPaper}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg shadow-xs flex items-center gap-1 active:scale-95"
              >
                <Printer size={12} />
                <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
              </button>
            </div>
          </div>

          {/* Responsive Paper Viewport Container */}
          <div
            className={`paper-viewport-wrapper w-full flex justify-center ${
              viewportWidth < 768 && paperZoom === '100' ? 'overflow-x-auto pb-6' : ''
            }`}
          >
            <div
              className="paper-scale-container origin-top transition-all duration-200"
              style={
                viewportWidth < 768 && paperZoom === 'fit'
                  ? {
                      zoom: Math.min(1, Math.max(0.35, (viewportWidth - 18) / (paperSize === 'Legal' ? 816 : 794)))
                    }
                  : undefined
              }
            >
              {/* White A4 / Legal Canvas Sheet (#paperSheet) */}
              <div
                id="paperSheet"
                style={{
                  width: viewportWidth < 768 && paperZoom === 'compact' ? '100%' : (paperSize === 'Legal' ? '216mm' : '210mm'),
                  minHeight: paperSize === 'Legal' ? '356mm' : '297mm',
                  padding: viewportWidth < 768 && paperZoom === 'compact'
                    ? '14px 16px'
                    : paperMargin === 'narrow'
                    ? '10mm 12mm'
                    : paperMargin === 'wide'
                    ? '22mm 22mm'
                    : '16mm 16mm',
                  fontFamily: `'${banglaFont}', '${englishFont}', serif`,
                  fontSize: viewportWidth < 768 && paperZoom === 'compact' ? `${Math.max(12, fontSize - 2)}px` : `${fontSize}px`,
                  lineHeight: lineHeight,
                  textAlign: textAlign,
                  fontWeight: isBold ? 'bold' : 'normal',
                  fontStyle: isItalic ? 'italic' : 'normal',
                  textDecoration: isUnderline ? 'underline' : 'none',
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
                      <span>{isBn ? 'সময়: ' : 'Time: '}</span>
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
                      <span>{isBn ? 'পূর্ণমান: ' : 'Total Marks: '}</span>
                      <span
                        id="examMarks"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => setExamMarksText(e.currentTarget.textContent || '')}
                        className="outline-none focus:bg-blue-50/60 px-1 border-b border-dashed border-slate-400"
                      >
                        {locNum(totalCalculatedMarks)}
                      </span>
                    </div>
                  </div>

                  {/* Toggleable Student Info Box (#studentInfoBar) */}
                  {showStudentInfo && (
                    <div
                      id="studentInfoBar"
                      className="mt-2 p-1.5 border border-black text-xs flex justify-between font-bold"
                    >
                      <span>{isBn ? 'শিক্ষার্থীর নাম: _____________________________' : 'Student Name: _____________________________'}</span>
                      <span>{isBn ? 'রোল: ________' : 'Roll: ________'}</span>
                      <span>{isBn ? 'শাখা: _____' : 'Sec: _____'}</span>
                      <span>{isBn ? 'তারিখ: _________' : 'Date: _________'}</span>
                    </div>
                  )}
                </header>

                {/* ================= SECTIONS & QUESTIONS ================= */}
                <div className="space-y-4">
                  {sections.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-xl my-6">
                      <FileText size={36} className="mx-auto text-slate-400 mb-2" />
                      <p className="text-sm font-bold text-slate-700">
                        {isBn ? 'প্রশ্নপত্রটি বর্তমানে খালি রয়েছে' : 'The question paper is currently empty'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {isBn
                          ? 'বামের প্রশ্ন সম্ভার থেকে প্রশ্ন যোগ করুন অথবা "১-ক্লিক প্রশ্ন তৈরি" বাটনে ক্লিক করে স্বয়ংক্রিয় প্রশ্নপত্র সাজান।'
                          : 'Add questions from the Question Bank on the left or click "1-Click Auto Paper".'}
                      </p>
                      <button
                        onClick={() => setShowAutoModal(true)}
                        className="mt-4 px-4 py-2 bg-[#2b579a] text-white text-xs font-bold rounded-lg shadow-sm hover:bg-[#20447c]"
                      >
                        {isBn ? '🪄 ১-ক্লিক প্রশ্ন তৈরি' : '🪄 1-Click Auto Paper'}
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
                            const qData = dragItem.current.data;
                            if (qData) {
                              addQuestionToPaper(qData, section.id);
                            }
                          }
                          dragItem.current = null;
                        }}
                        className="q-section relative group/sec pb-2 border-b border-slate-200 last:border-b-0 break-inside-avoid"
                      >
                        {/* Per-Section Floating Controls (Hidden on Print) */}
                        <div className="sec-toolbar no-print flex md:hidden group-hover/sec:flex items-center gap-1 bg-slate-900 text-white px-2 py-1 rounded-md shadow-lg z-20 text-[11px] mb-1.5 md:mb-0 md:absolute md:-top-4 md:right-0 flex-wrap">
                          {/* Layout */}
                          <select
                            value={section.layout}
                            onChange={e => {
                              const val = e.target.value as PaperSection['layout'];
                              setSections(prev => prev.map(s => s.id === section.id ? { ...s, layout: val } : s));
                            }}
                            className="bg-slate-800 text-white text-[10.5px] rounded px-1.5 py-0.5 border border-slate-700 font-medium"
                          >
                            <option value="1_col">{isBn ? '১ কলাম' : '1 Column'}</option>
                            <option value="2_col">{isBn ? '২ কলাম' : '2 Columns'}</option>
                            <option value="3_col">{isBn ? '৩ কলাম' : '3 Columns'}</option>
                            <option value="4_col">{isBn ? '৪ কলাম' : '4 Columns'}</option>
                          </select>

                          {/* Numbering Format */}
                          <select
                            value={section.numbering_style}
                            onChange={e => {
                              const val = e.target.value as PaperSection['numbering_style'];
                              setSections(prev => prev.map(s => s.id === section.id ? { ...s, numbering_style: val } : s));
                            }}
                            className="bg-slate-800 text-white text-[10.5px] rounded px-1.5 py-0.5 border border-slate-700 font-medium"
                          >
                            <option value="bangla_letter">ক, খ, গ...</option>
                            <option value="bangla_number">১, ২, ৩...</option>
                            <option value="english_number">1, 2, 3...</option>
                            <option value="english_letter">a, b, c...</option>
                            <option value="arabic_number">١, ٢, ٣</option>
                            <option value="none">{isBn ? 'নাম্বার ছাড়া' : 'None'}</option>
                          </select>

                          {/* Move Up/Down */}
                          <button
                            type="button"
                            disabled={sIdx === 0}
                            onClick={() => moveSection(sIdx, 'up')}
                            className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"
                            title={isBn ? 'বিভাগ উপরে নিন' : 'Move Up'}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={sIdx === sections.length - 1}
                            onClick={() => moveSection(sIdx, 'down')}
                            className="p-1 hover:bg-slate-800 rounded disabled:opacity-30"
                            title={isBn ? 'বিভাগ নিচে নিন' : 'Move Down'}
                          >
                            ▼
                          </button>

                          {/* Add Custom Question */}
                          <button
                            type="button"
                            onClick={() => addCustomQuestion(section.id)}
                            className="px-1.5 py-0.5 bg-blue-700 hover:bg-blue-600 rounded text-[10.5px] font-bold"
                          >
                            {isBn ? '+ প্রশ্ন' : '+ Question'}
                          </button>

                          {/* Delete Section */}
                          <button
                            type="button"
                            onClick={() => deleteSection(section.id)}
                            className="p-1 hover:bg-red-700 text-red-300 hover:text-white rounded"
                            title={isBn ? 'বিভাগ মুছুন' : 'Delete Section'}
                          >
                            🗑
                          </button>
                        </div>

                        {/* Section Header */}
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <div className="flex items-baseline gap-1.5 flex-1">
                            <span className="font-bold text-sm md:text-base">{locNum(sIdx + 1)}।</span>
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

                          {/* Marks Formula */}
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

                        {/* Questions List/Grid */}
                        <div
                          dir={section.direction}
                          style={{
                            fontFamily: section.direction === 'rtl' ? `'${arabicFont}', serif` : undefined,
                            fontSize: section.direction === 'rtl' ? `${fontSize + 1.5}px` : undefined,
                            gap: `${questionGap}px`
                          }}
                          className={`grid ${
                            section.layout === '3_col'
                              ? 'grid-cols-1 md:grid-cols-3 gap-x-4'
                              : section.layout === '4_col'
                              ? 'grid-cols-2 md:grid-cols-4 gap-x-3'
                              : section.layout === '1_col'
                              ? 'grid-cols-1'
                              : (paperColumns === '2_col' || section.layout === '2_col')
                              ? 'grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5'
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
                              className="relative group/q py-1 px-1.5 rounded hover:bg-slate-50 transition flex flex-col"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-start gap-1.5 flex-1">
                                  {/* Numbering */}
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

                                {/* Marks */}
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
                                  title={isBn ? 'নম্বর এডিট করুন' : 'Edit marks'}
                                >
                                  [{locNum(question.marks || 1)}]
                                </span>
                              </div>

                              {/* MCQ Options */}
                              {question.options && question.options.length > 0 && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 pl-4 text-xs">
                                  {question.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex items-center gap-1">
                                      <span className="font-semibold">{getNumberingLabel(oIdx, isBn ? 'bangla_letter' : 'english_letter')}</span>
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Matching Table */}
                              {question.left_items && question.right_items && (
                                <div className="mt-2 w-full overflow-x-auto">
                                  <table className="w-full border-collapse border border-black text-xs md:text-sm">
                                    <thead>
                                      <tr className="bg-slate-100 border-b border-black">
                                        <th className="border-r border-black p-1 text-left font-bold w-1/2">
                                          {isBn ? 'বাম পাশ (কলাম ক)' : 'Left Column (Column A)'}
                                        </th>
                                        <th className="p-1 text-left font-bold w-1/2">
                                          {isBn ? 'ডান পাশ (কলাম খ)' : 'Right Column (Column B)'}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {question.left_items.map((left, idx) => (
                                        <tr key={idx} className="border-b border-black/30 last:border-b-0">
                                          <td className="border-r border-black p-1 font-medium">{left}</td>
                                          <td className="p-1 font-medium">{question.right_items?.[idx] || ''}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Dotted Lines for Handwriting */}
                              {section.dotted_lines && section.dotted_lines > 0 ? (
                                <div className="mt-1.5 space-y-2">
                                  {Array.from({ length: section.dotted_lines }).map((_, lIdx) => (
                                    <div key={lIdx} className="write-line w-full border-b border-dotted border-slate-500 h-3.5" />
                                  ))}
                                </div>
                              ) : null}

                              {/* Answer Sheet Display */}
                              {showAnswerSheet && question.answer_text && (
                                <div className="paper-ans mt-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded inline-block self-start">
                                  [{isBn ? 'উত্তর:' : 'Answer:'} {question.answer_text}]
                                </div>
                              )}

                              {/* Touch-Friendly Up, Down, Delete Actions */}
                              <div className="no-print absolute top-0.5 right-0.5 flex md:hidden group-hover/q:flex items-center gap-0.5 bg-white border border-slate-300 rounded shadow-xs text-[11px] p-0.5 z-10">
                                <button
                                  type="button"
                                  disabled={qIdx === 0}
                                  onClick={(e) => { e.stopPropagation(); moveQuestion(sIdx, qIdx, 'up'); }}
                                  className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded disabled:opacity-20 text-slate-700 font-bold active:scale-90"
                                  title={isBn ? 'উপরে নিন' : 'Move Up'}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={qIdx === section.questions.length - 1}
                                  onClick={(e) => { e.stopPropagation(); moveQuestion(sIdx, qIdx, 'down'); }}
                                  className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded disabled:opacity-20 text-slate-700 font-bold active:scale-90"
                                  title={isBn ? 'নিচে নিন' : 'Move Down'}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); deleteQuestion(section.id, question.id); }}
                                  className="w-5 h-5 flex items-center justify-center hover:bg-red-50 rounded text-red-600 font-bold active:scale-90"
                                  title={isBn ? 'প্রশ্ন মুছুন' : 'Delete Question'}
                                >
                                  ×
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
            </div>
          </div>
        </main>

        {/* ================= RIGHT PANE: SETTINGS & TOOLS (Desktop: w-[300px]) ================= */}
        <aside
          className={`w-full md:w-[300px] bg-white dark:bg-[#111827] border-l border-slate-300 dark:border-slate-800 flex flex-col shrink-0 z-20 ${
            mobilePane === 'settings' || mobilePane === 'actions' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders size={16} className="text-[#2b579a]" />
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
                {mobilePane === 'actions' ? (isBn ? 'ডাউনলোড ও অ্যাকশন' : 'Download & Actions') : (isBn ? 'ডকুমেন্ট ফরম্যাটিং ও সেটিংস' : 'Document Formatting & Settings')}
              </h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar text-xs">
            
            {/* Quick Action Buttons on Mobile Actions Tab */}
            {mobilePane === 'actions' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={exportToWordDoc}
                  className="w-full py-2.5 bg-[#2b579a] text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileDown size={16} />
                  <span>{isBn ? 'ওয়ার্ড ডাউনলোড (.doc)' : 'Download Word (.doc)'}</span>
                </button>
                <button
                  type="button"
                  onClick={printPaper}
                  className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm"
                >
                  <Printer size={16} />
                  <span>{isBn ? 'প্রিন্ট করুন' : 'Print'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAutoModal(true)}
                  className="w-full py-2.5 bg-amber-500 text-slate-950 font-black rounded-lg flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles size={16} />
                  <span>{isBn ? '🪄 ১-ক্লিক প্রশ্ন তৈরি' : '🪄 1-Click Auto Paper'}</span>
                </button>
                <button
                  type="button"
                  onClick={saveCurrentDraft}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg flex items-center justify-center gap-2 border border-slate-300"
                >
                  <Save size={16} />
                  <span>{isBn ? 'ড্রাফট সংরক্ষণ' : 'Save Draft'}</span>
                </button>
              </div>
            )}

            {/* Typography & Slider Controls */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Type size={14} className="text-[#2b579a]" />
                <span>{isBn ? 'ফন্ট ও স্পেসিং কন্ট্রোল:' : 'Font & Spacing Controls:'}</span>
              </h4>

              {/* Font Size Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                  <span>{isBn ? 'ফন্টের আকার' : 'Font Size'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{locNum(fontSize)} pt</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="22"
                  step="0.5"
                  value={fontSize}
                  onChange={e => setFontSize(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#2b579a]"
                />
              </div>

              {/* Line Height Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                  <span>{isBn ? 'লাইনের দূরত্ব' : 'Line Spacing'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{locNum(lineHeight)}</span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="2.2"
                  step="0.05"
                  value={lineHeight}
                  onChange={e => setLineHeight(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#2b579a]"
                />
              </div>

              {/* Question Gap Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                  <span>{isBn ? 'প্রশ্নের ফাঁকা' : 'Question Gap'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{locNum(questionGap)} pt</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="18"
                  step="1"
                  value={questionGap}
                  onChange={e => setQuestionGap(parseInt(e.target.value) || 6)}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#2b579a]"
                />
              </div>
            </div>

            {/* Saved Drafts List */}
            {savedPapers.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                  <FolderOpen size={14} className="text-[#2b579a]" />
                  <span>{isBn ? `সংরক্ষিত প্রশ্নপত্রসমূহ (${locNum(savedPapers.length)}):` : `Saved Papers (${savedPapers.length}):`}</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {savedPapers.map(p => (
                    <div
                      key={p.id}
                      onClick={() => loadDraft(p)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50 dark:bg-slate-850 cursor-pointer transition text-left"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.title}</div>
                      <div className="text-[10px] text-slate-500 flex justify-between mt-0.5">
                        <span>{isBn ? 'মোট:' : 'Total:'} {locNum(p.total_marks)}</span>
                        <span>{new Date(p.created_at).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ================= 1-CLICK MAGIC QUESTION GENERATOR MODAL ================= */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪄</span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                    {isBn ? '১-ক্লিক প্রশ্নপত্র তৈরি' : '1-Click Auto Paper Generator'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isBn ? 'বোর্ড, শ্রেণি ও সিলেবাস অনুযায়ী অটোমেটিক ব্যালান্সড প্রশ্ন সাজান' : 'Automatically create a balanced question paper'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Marks Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isBn ? 'টার্গেট পূর্ণমান নির্বাচন করুন:' : 'Select Target Marks:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAutoTargetMarks(50);
                    setAutoMcqCount(5);
                    setAutoFillBlankCount(5);
                    setAutoShortCount(5);
                    setAutoBroadCount(3);
                    setAutoArabicCount(3);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-black transition ${
                    autoTargetMarks === 50
                      ? 'bg-[#2b579a] text-white border-[#2b579a] shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                  }`}
                >
                  {isBn ? '৫০ নম্বর (অর্ধবার্ষিক / সাময়িক)' : '50 Marks (Term Exam)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoTargetMarks(100);
                    setAutoMcqCount(10);
                    setAutoFillBlankCount(10);
                    setAutoShortCount(10);
                    setAutoBroadCount(6);
                    setAutoArabicCount(6);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-black transition ${
                    autoTargetMarks === 100
                      ? 'bg-[#2b579a] text-white border-[#2b579a] shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                  }`}
                >
                  {isBn ? '১০০ নম্বর (বার্ষিক / ফাইনাল)' : '100 Marks (Annual Exam)'}
                </button>
              </div>
            </div>

            {/* Board Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isBn ? 'বোর্ড:' : 'Board:'}
              </label>
              <select
                value={selectedBoardId}
                onChange={e => {
                  setSelectedBoardId(e.target.value);
                  const newFiltered = books.filter(b => doesBoardMatch(b.board, e.target.value) && doesClassMatch(b.class_name, selectedClass));
                  if (newFiltered.length > 0) setSelectedBookId(newFiltered[0].id);
                }}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-lg p-2 font-medium"
              >
                {supportedBoardsList.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Book Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isBn ? 'পাঠ্যবই:' : 'Book:'}
              </label>
              <select
                value={selectedBookId}
                onChange={e => setSelectedBookId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-lg p-2 font-medium truncate"
              >
                {filteredBooks.map(b => (
                  <option key={b.id} value={b.id}>{b.title} ({b.class_name})</option>
                ))}
              </select>
            </div>

            {/* Counts Breakdown Preview */}
            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'স্বয়ংক্রিয় বিভাগ বণ্টন:' : 'Automatic Distribution:'}
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{isBn ? '১. সঠিক উত্তর (এমসিকিউ):' : '1. Multiple Choice (MCQ):'}</span>
                <span className="font-bold">{locNum(autoMcqCount)} {isBn ? 'টি প্রশ্ন' : 'Questions'}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{isBn ? '২. শূন্যস্থান পূরণ:' : '2. Fill in the Blanks:'}</span>
                <span className="font-bold">{locNum(autoFillBlankCount)} {isBn ? 'টি প্রশ্ন' : 'Questions'}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{isBn ? '৩. সংক্ষিপ্ত প্রশ্নোত্তর:' : '3. Short Questions:'}</span>
                <span className="font-bold">{locNum(autoShortCount)} {isBn ? 'টি প্রশ্ন' : 'Questions'}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{isBn ? '৪. রচনামূলক / বড় প্রশ্ন:' : '4. Descriptive Questions:'}</span>
                <span className="font-bold">{locNum(autoBroadCount)} {isBn ? 'টি প্রশ্ন' : 'Questions'}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAutoModal(false)}
                className="flex-1 py-2.5 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeAutoGenerator}
                className="flex-1 py-2.5 bg-[#2b579a] hover:bg-[#20447c] text-white font-black rounded-xl text-xs shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>{isBn ? 'প্রশ্নপত্র তৈরি করুন' : 'Generate Paper'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRO UPGRADE MODAL ================= */}
      {showProModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 dark:border-amber-700/60 text-center">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Crown size={24} />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              {isBn ? 'ডিজিটাল প্রশ্ন ব্যাংক প্রো' : 'Question Bank Pro'}
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-1">
              {proModalReason || (isBn ? '৩৮৫টি বইয়ের পূর্ণ প্রশ্ন সম্ভার ও প্রিন্ট এক্সপোর্ট' : 'Full 385 books catalog & print export')}
            </p>

            <div className="my-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-left text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{isBn ? '৩৮৫টি নূরানী, বেফাক, আলিয়া ও NCTB বইয়ের প্রশ্ন আনলক' : 'Unlock full questions for 385 curriculum books'}</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{isBn ? 'আনলিমিটেড প্রিন্ট ও হাই-কোয়ালিটি A4 PDF এক্সপোর্ট' : 'Unlimited print & high-resolution A4 PDF export'}</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{isBn ? 'Microsoft Word (.doc) ফরম্যাটে ১-ক্লিক রূপান্তর' : '1-Click Microsoft Word (.doc) document export'}</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{isBn ? 'শিক্ষক উত্তরমালা (Answer Key) তৈরি ও ক্লাউড সেভ' : 'Teacher answer keys and cloud drafts'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowProModal(false)}
                className="flex-1 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs"
              >
                {isBn ? 'পরে করব' : 'Later'}
              </button>
              <button
                type="button"
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
                {isBn ? 'আপগ্রেড করুন' : 'Upgrade Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FIXED BOTTOM MOBILE TAB SWITCHER ================= */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around no-print"
      >
        <button
          type="button"
          onClick={() => setMobilePane('paper')}
          className={`flex-1 min-h-[44px] relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 ${
            mobilePane === 'paper'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-[#2b579a] dark:text-blue-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="text-base leading-none mb-0.5">📝</span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] leading-tight font-bold">{isBn ? 'এডিটর' : 'Editor'}</span>
            {totalQuestionsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#2b579a] text-white rounded-full text-[9px] font-black shadow-xs">
                {locNum(totalQuestionsCount)}
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobilePane('library')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 ${
            mobilePane === 'library'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-[#2b579a] dark:text-blue-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="text-base leading-none mb-0.5">📚</span>
          <span className="text-[11px] leading-tight font-bold">{isBn ? 'প্রশ্নব্যাংক' : 'Question Bank'}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobilePane('settings')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 ${
            mobilePane === 'settings'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-[#2b579a] dark:text-blue-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="text-base leading-none mb-0.5">⚙️</span>
          <span className="text-[11px] leading-tight font-bold">{isBn ? 'ফন্ট ও বর্ডার' : 'Tools'}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobilePane('actions')}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition active:scale-95 ${
            mobilePane === 'actions'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-[#2b579a] dark:text-blue-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="text-base leading-none mb-0.5">📥</span>
          <span className="text-[11px] leading-tight font-bold">{isBn ? 'ডাউনলোড' : 'Download'}</span>
        </button>
      </nav>

      {/* ================= TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2.5 z-50 border border-slate-700/80 animate-fade-in max-w-[92vw]">
          <div className="flex items-center gap-1.5 shrink-0">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span className="truncate">{toastMessage}</span>
          </div>
          {toastAction && (
            <button
              onClick={() => {
                toastAction.onClick();
                setToastMessage(null);
                setToastAction(null);
              }}
              className="px-2.5 py-0.5 bg-[#2b579a] hover:bg-[#20447c] text-white rounded-full text-[11px] font-black shrink-0 transition active:scale-95 shadow-xs"
            >
              {toastAction.label}
            </button>
          )}
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
          .paper-viewport-wrapper, .paper-scale-container {
            width: 100% !important;
            max-width: 100% !important;
            transform: none !important;
            zoom: 1 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #paperSheet {
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            border-color: #000 !important;
            transform: none !important;
            zoom: 1 !important;
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
