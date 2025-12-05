
import React, { useState, useMemo, useEffect, useRef } from 'react';
import AdminPanel from './components/AdminPanel';
import QuizCard from './components/QuizCard';
import AITutor from './components/AITutor';
import ResultStats from './components/ResultStats';
import { Question, FilterState, ExamConfig, StudentSubmission, ExamSection, StudentAccount } from './types';
import { 
  ChevronRight, ChevronLeft, GraduationCap, 
  Target, CheckSquare, BarChart2, Clock, 
  LayoutDashboard, FileText, UserCog, Play, Timer, FileQuestion, Calendar,
  LogOut, Shuffle, Lock, User, Key
} from 'lucide-react';
import { parseQuestionsFromCSV, parseStudentAccountsFromCSV, parseExamsFromCSV } from './utils/csvParser';

const REVIEW_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1RSJ_7BWPjez8Ui78tuEap0CPAY9hGfRaCFiz8odrKiQ/edit?gid=0#gid=0";
const EXAM_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1M1WohVZcWQzU0tgJGQuvnk-VgfvdLAw0mwK7kOzguys/edit?usp=drivesdk";
const STUDENT_ACCOUNT_LINK = "https://docs.google.com/spreadsheets/d/14zR_2xMECMMI_AYk8GeUJdeaCcfDQM3Bp2xr-G3DLhk/edit?gid=0#gid=0";

// NEW: Link for Exam Question Pool (Data De Thi)
const EXAM_POOL_LINK = "https://docs.google.com/spreadsheets/d/1_WNzDFK-3ko3aK-9ZUUROMtioB7-tQ8cqUbOuFEwpvk/edit?usp=sharing";

type Tab = 'review' | 'exam' | 'admin';

// PRNG (Pseudo-Random Number Generator) for reproducible shuffles
function seededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Shuffle function that accepts an optional custom random generator
function shuffleArray<T>(array: T[], randomGen?: () => number): T[] {
  const newArray = [...array];
  const rand = randomGen || Math.random;
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const processQuizData = (questions: Question[], shuffleQ: boolean, shuffleA: boolean, randomGen?: () => number): Question[] => {
  let processed = [...questions];
  if (shuffleQ) processed = shuffleArray<Question>(processed, randomGen);
  
  if (shuffleA) {
    processed = processed.map(q => {
      const options = [
        { key: 'A', content: q.dapAnA },
        { key: 'B', content: q.dapAnB },
        { key: 'C', content: q.dapAnC },
        { key: 'D', content: q.dapAnD },
      ];
      const correctOption = options.find(o => o.key === q.dapAnDung);
      const correctContent = correctOption ? correctOption.content : '';
      const shuffledOptions = shuffleArray<{ key: string; content: string }>([...options], randomGen);
      const newQ: Question = { ...q };
      let newCorrectKey: 'A' | 'B' | 'C' | 'D' = 'A';
      shuffledOptions.forEach((opt, index) => {
        const newKey = ['A', 'B', 'C', 'D'][index] as 'A'|'B'|'C'|'D';
        if (newKey === 'A') newQ.dapAnA = opt.content;
        if (newKey === 'B') newQ.dapAnB = opt.content;
        if (newKey === 'C') newQ.dapAnC = opt.content;
        if (newKey === 'D') newQ.dapAnD = opt.content;
        if (opt.content === correctContent) newCorrectKey = newKey;
      });
      newQ.dapAnDung = newCorrectKey;
      return newQ;
    });
  }
  return processed;
};

// Calculate Similarity Logic
const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const set1 = new Set(s1);
    const set2 = new Set(s2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
};

// Selection Logic to avoid duplicates
const selectDiverseQuestions = (pool: Question[], count: number, randomGen?: () => number): Question[] => {
    // Basic shuffle first
    const shuffled = shuffleArray<Question>(pool, randomGen);
    const selected: Question[] = [];
    
    for (const q of shuffled) {
       if (selected.length >= count) break;
       
       // Check if this question is too similar to any already selected
       const isTooSimilar = selected.some(sel => calculateSimilarity(sel.cauHoi, q.cauHoi) > 0.7);
       
       if (!isTooSimilar) {
          selected.push(q);
       }
    }

    // If we didn't get enough unique questions, fill with remaining
    if (selected.length < count) {
        const remaining = shuffled.filter(q => !selected.includes(q));
        selected.push(...remaining.slice(0, count - selected.length));
    }

    return selected;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getExportUrl = (url: string) => {
  try {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
    
    if (idMatch && idMatch[1]) {
        let exportUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv`;
        if (gidMatch && gidMatch[1]) {
            exportUrl += `&gid=${gidMatch[1]}`;
        }
        return exportUrl;
    }
    return url;
  } catch { return url; }
};

// NEW: Helper to fetch with Cache Busting
const fetchWithNoCache = async (url: string) => {
    const exportUrl = getExportUrl(url);
    // Append timestamp to force fresh fetch
    const separator = exportUrl.includes('?') ? '&' : '?';
    const finalUrl = `${exportUrl}${separator}t=${Date.now()}`;
    
    const response = await fetch(finalUrl, {
        cache: 'no-store',
        headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
    }
    return await response.text();
};

const TIME_OPTIONS = [
  { label: 'Không giới hạn', value: 0 },
  { label: '1 phút', value: 1 },
  { label: '5 phút', value: 5 },
  { label: '15 phút', value: 15 },
  { label: '30 phút', value: 30 },
  { label: '45 phút', value: 45 },
  { label: '60 phút', value: 60 },
  { label: 'Tùy chỉnh...', value: -1 },
];

const COUNT_OPTIONS = [
  { label: 'Tất cả', value: 0 },
  { label: '5 câu', value: 5 },
  { label: '10 câu', value: 10 },
  { label: '20 câu', value: 20 },
  { label: '40 câu', value: 40 },
  { label: '50 câu', value: 50 },
];

const App: React.FC = () => {
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [studentAccounts, setStudentAccounts] = useState<StudentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [createdExams, setCreatedExams] = useState<ExamConfig[]>([]);

  const [submissions, setSubmissions] = useState<StudentSubmission[]>(() => {
     try {
       const saved = localStorage.getItem('mathMaster_submissions');
       return saved ? JSON.parse(saved) : [];
     } catch(e) { return []; }
  });

  useEffect(() => { localStorage.setItem('mathMaster_submissions', JSON.stringify(submissions)); }, [submissions]);

  const [activeTab, setActiveTab] = useState<Tab>('review'); 
  const [filters, setFilters] = useState<FilterState>({ lop: '', chuDe: '', bai: '' });
  const [selectedTimeOption, setSelectedTimeOption] = useState(0);
  const [customTimeInput, setCustomTimeInput] = useState('90');
  const [selectedCountOption, setSelectedCountOption] = useState(0);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(true);

  const [studentInfo, setStudentInfo] = useState<{ name: string; class: string } | null>(null);
  const [loggedInStudent, setLoggedInStudent] = useState<StudentAccount | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [pendingExamConfig, setPendingExamConfig] = useState<ExamConfig | null>(null);
  const [currentExamAllowReview, setCurrentExamAllowReview] = useState(true); 
  const [selectedVariant, setSelectedVariant] = useState(1);

  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isTutorOpen, setIsTutorOpen] = useState(false);

  useEffect(() => {
    const autoLoadData = async () => {
      try {
        setLoading(true);
        // Load in parallel
        const results = await Promise.allSettled([
            fetchWithNoCache(REVIEW_SHEET_LINK),
            fetchWithNoCache(EXAM_SHEET_LINK),
            fetchWithNoCache(STUDENT_ACCOUNT_LINK),
            fetchWithNoCache(EXAM_POOL_LINK)
        ]);

        // Helper to get value or empty string
        const getText = (res: PromiseSettledResult<string>) => res.status === 'fulfilled' ? res.value : '';

        const reviewText = getText(results[0]);
        const examListText = getText(results[1]);
        const studentText = getText(results[2]);
        const examPoolText = getText(results[3]);
        
        const parsedReview = parseQuestionsFromCSV(reviewText);
        setReviewQuestions(parsedReview);

        const parsedExams = parseExamsFromCSV(examListText);
        setCreatedExams(parsedExams);
        
        const parsedStudents = parseStudentAccountsFromCSV(studentText);
        setStudentAccounts(parsedStudents);
        
        const parsedExamPool = parseQuestionsFromCSV(examPoolText);
        setExamQuestions(parsedExamPool);

        // Logic to determine initial tab
        if (parsedReview.length > 0) setActiveTab('review');
        else if (parsedExams.length > 0) setActiveTab('exam');
        
        // Log for debugging
        console.log(`Loaded: ${parsedReview.length} review questions, ${parsedExams.length} exams, ${parsedExamPool.length} exam pool questions.`);

      } catch (error) { 
        console.error("Auto load error", error);
      } finally { setLoading(false); }
    };
    autoLoadData();
  }, []);

  const availableClasses = useMemo(() => Array.from(new Set(reviewQuestions.map(q => q.lop).filter(Boolean))).sort(), [reviewQuestions]);
  
  const availableTopics = useMemo(() => {
    let q = reviewQuestions;
    if (filters.lop) q = q.filter(item => item.lop === filters.lop);
    return Array.from(new Set(q.map(item => item.chuDe).filter(Boolean))).sort();
  }, [reviewQuestions, filters.lop]);

  const availableLessons = useMemo(() => {
    let q = reviewQuestions;
    if (filters.lop) q = q.filter(item => item.lop === filters.lop);
    if (filters.chuDe) q = q.filter(item => item.chuDe === filters.chuDe);
    return Array.from(new Set(q.map(item => item.bai).filter(Boolean))).sort();
  }, [reviewQuestions, filters.lop, filters.chuDe]);

  const poolQuestions = useMemo(() => {
    return reviewQuestions.filter(q => {
      if (filters.lop && q.lop !== filters.lop) return false;
      if (filters.chuDe && q.chuDe !== filters.chuDe) return false;
      if (filters.bai && q.bai !== filters.bai) return false;
      return true;
    });
  }, [reviewQuestions, filters]);

  useEffect(() => {
    if (isQuizStarted && !isSubmitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isQuizStarted, isSubmitted, timeLeft]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isQuizStarted && !isSubmitted && studentInfo) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isQuizStarted, isSubmitted, studentInfo]);

  // Handle manual Refresh Button
  const handleManualRefresh = async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
            fetchWithNoCache(REVIEW_SHEET_LINK),
            fetchWithNoCache(EXAM_SHEET_LINK),
            fetchWithNoCache(STUDENT_ACCOUNT_LINK),
            fetchWithNoCache(EXAM_POOL_LINK)
        ]);
        const getText = (res: PromiseSettledResult<string>) => res.status === 'fulfilled' ? res.value : '';

        setReviewQuestions(parseQuestionsFromCSV(getText(results[0])));
        setCreatedExams(parseExamsFromCSV(getText(results[1])));
        setStudentAccounts(parseStudentAccountsFromCSV(getText(results[2])));
        setExamQuestions(parseQuestionsFromCSV(getText(results[3])));
        
        alert("Đã cập nhật dữ liệu mới nhất từ Google Sheet!");
      } catch (e) {
          alert("Lỗi cập nhật: " + (e instanceof Error ? e.message : "Unknown error"));
      } finally {
          setLoading(false);
      }
  };

  const handleDataUpdate = (data: Question[]) => setReviewQuestions(data);
  const handleCreateExam = (exam: ExamConfig) => setCreatedExams(prev => [exam, ...prev]);
  const handleDeleteExam = (id: string) => { if (confirm("Bạn có chắc muốn xóa bài thi này không?")) setCreatedExams(prev => prev.filter(e => e.id !== id)); };
  const handleClearExams = () => { if (confirm("CẢNH BÁO: Xóa TOÀN BỘ danh sách đề thi?")) setCreatedExams([]); };
  const handleClearSubmissions = () => setSubmissions([]);

  const handleStartReview = () => {
    setStudentInfo(null); 
    setLoggedInStudent(null);
    setPendingExamConfig(null);
    setCurrentExamAllowReview(true); 
    startQuizLogic(poolQuestions, selectedCountOption, selectedTimeOption === -1 ? parseInt(customTimeInput) || 0 : selectedTimeOption, isShuffleEnabled, isShuffleEnabled);
  };

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPass) return;
    
    // Simple normalization for comparison
    const norm = (s: string) => s.trim();
    
    const account = studentAccounts.find(acc => norm(acc.id) === norm(loginId) && norm(acc.password) === norm(loginPass));
    if (account) {
      setLoggedInStudent(account);
      setStudentInfo({ name: account.name, class: account.className });
      setLoginError('');
      setLoginId('');
      setLoginPass('');
    } else {
      setLoginError('Sai Mã học sinh hoặc Mật khẩu.');
    }
  };

  const handleStudentLogout = () => {
    setLoggedInStudent(null);
    setStudentInfo(null);
    setIsQuizStarted(false);
  };

  const getTakenVariants = (examId: string) => {
    try {
      const stored = localStorage.getItem(`mathMaster_takenVariants_${examId}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };

  const handlePrepareExam = (config: ExamConfig) => {
    setPendingExamConfig(config);
    // Determine available variants if hiding logic is active
    let initialVariant = 1;
    if (config.hideTakenVariants && config.variants > 1) {
        const taken = getTakenVariants(config.id);
        const available = Array.from({length: config.variants}, (_, i) => i + 1).filter(v => !taken.includes(v));
        if (available.length > 0) initialVariant = available[0];
    }
    setSelectedVariant(initialVariant);

    // If variants > 1, show modal to pick. If 1, start immediately.
    if (config.variants > 1) {
       setShowVariantModal(true);
    } else {
       handleStartExam(initialVariant);
    }
  };

  const handleStartExam = (variant: number) => {
    if (!pendingExamConfig || !loggedInStudent) return;
    
    // Save taken variant if feature is enabled
    if (pendingExamConfig.hideTakenVariants && pendingExamConfig.variants > 1) {
       const taken = getTakenVariants(pendingExamConfig.id);
       if (!taken.includes(variant)) {
           taken.push(variant);
           localStorage.setItem(`mathMaster_takenVariants_${pendingExamConfig.id}`, JSON.stringify(taken));
       }
    }

    setCurrentExamAllowReview(pendingExamConfig.allowReview !== undefined ? pendingExamConfig.allowReview : true);
    
    // Create a deterministic random generator based on Exam ID + Variant
    // This ensures every student taking "Exam X - Variant Y" gets the exact same questions
    const seedString = `${pendingExamConfig.id}-v${variant}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
        hash |= 0;
    }
    const randomGen = seededRandom(Math.abs(hash));

    let selectedQuestions: Question[] = [];

    // --- NEW LOGIC: Use Sections if available ---
    if (pendingExamConfig.sections && pendingExamConfig.sections.length > 0) {
       pendingExamConfig.sections.forEach(sec => {
          // 1. Filter pool by Class/Topic/Lesson
          let pool = examQuestions;
          if (sec.targetClass && sec.targetClass !== 'All') pool = pool.filter(q => q.lop === sec.targetClass);
          if (sec.selectedTopic) pool = pool.filter(q => q.chuDe === sec.selectedTopic);
          if (sec.selectedLesson) pool = pool.filter(q => q.bai === sec.selectedLesson);

          // 2. Helper to filter by Level loosely
          const filterByLevel = (p: Question[], levelKeyword: string) => {
             return p.filter(q => q.mucDo && q.mucDo.toLowerCase().includes(levelKeyword.toLowerCase()));
          };

          const poolBiet = filterByLevel(pool, 'biết');
          const poolHieu = filterByLevel(pool, 'hiểu');
          const poolVanDung = filterByLevel(pool, 'vận dụng');
          
          // 3. Select with Seeded Random Logic
          const questionsBiet: Question[] = selectDiverseQuestions(poolBiet, sec.countBiet, randomGen);
          const questionsHieu: Question[] = selectDiverseQuestions(poolHieu, sec.countHieu, randomGen);
          const questionsVanDung: Question[] = selectDiverseQuestions(poolVanDung, sec.countVanDung, randomGen);

          selectedQuestions = [...selectedQuestions, ...questionsBiet, ...questionsHieu, ...questionsVanDung];
       });
    } 
    // --- OLD LOGIC: Backward Compatibility ---
    else {
        let examPool = examQuestions;
        if (pendingExamConfig.targetClass && pendingExamConfig.targetClass !== 'All') {
          examPool = examPool.filter(q => q.lop === pendingExamConfig.targetClass);
        }
        if (pendingExamConfig.selectedTopic) {
          examPool = examPool.filter(q => q.chuDe === pendingExamConfig.selectedTopic);
        }
        if (pendingExamConfig.selectedLesson) {
          examPool = examPool.filter(q => q.bai === pendingExamConfig.selectedLesson);
        }
        
        // Take N seeded random questions
        selectedQuestions = shuffleArray<Question>(examPool, randomGen).slice(0, pendingExamConfig.questionCount || 20);
    }

    if (selectedQuestions.length === 0) {
      alert("Không tìm thấy câu hỏi nào phù hợp với cấu trúc đề thi này (kiểm tra lại dữ liệu hoặc mức độ câu hỏi).");
      return;
    }

    startQuizLogic(
      selectedQuestions, 
      selectedQuestions.length, // Use actual count found
      pendingExamConfig.duration, 
      pendingExamConfig.shuffleQuestions,
      pendingExamConfig.shuffleAnswers,
      randomGen // Pass generator for answers shuffling too
    );
    setShowVariantModal(false);
  };

  const startQuizLogic = (pool: Question[], count: number, timeMinutes: number, shuffleQuestions: boolean, shuffleAnswers: boolean, randomGen?: () => number) => {
    let processedQuestions = processQuizData(pool, shuffleQuestions, shuffleAnswers, randomGen);
    if (count > 0 && count < processedQuestions.length) processedQuestions = processedQuestions.slice(0, count);

    setQuizQuestions(processedQuestions);
    setCurrentIndex(0);
    setUserAnswers({});
    setIsSubmitted(false);
    setShowResults(false);
    setTimeLeft(timeMinutes * 60);
    setIsQuizStarted(true);
  };

  const handleTimeUp = () => { alert("Hết giờ làm bài!"); setIsSubmitted(true); setShowResults(true); if (timerRef.current) clearInterval(timerRef.current); };
  const handleAnswer = (answer: 'A'|'B'|'C'|'D') => { if (!quizQuestions[currentIndex] || isSubmitted) return; setUserAnswers(prev => ({ ...prev, [quizQuestions[currentIndex].id]: answer })); };
  const handleSubmit = () => { if (window.confirm("Nộp bài?")) { setIsSubmitted(true); setShowResults(true); if (timerRef.current) clearInterval(timerRef.current); } };
  
  const handleSaveResult = (metrics: { score: number, correct: number, total: number }) => {
    if (studentInfo && pendingExamConfig) {
       setSubmissions(prev => [...prev, {
         id: `sub-${Date.now()}`,
         studentName: studentInfo.name, className: studentInfo.class,
         examId: pendingExamConfig.id, examTitle: pendingExamConfig.title,
         score: metrics.score, correctCount: metrics.correct, totalQuestions: metrics.total,
         submittedAt: new Date().toISOString()
       }]);
    }
  };

  const handleReset = () => { setIsQuizStarted(false); setIsSubmitted(false); setShowResults(false); setCurrentIndex(0); setUserAnswers({}); setStudentInfo(null); setLoggedInStudent(null); if (timerRef.current) clearInterval(timerRef.current); };
  const currentQuestion = quizQuestions[currentIndex];

  const getVariantOptions = () => {
    if (!pendingExamConfig || !pendingExamConfig.variants) return [];
    
    let variants = Array.from({length: pendingExamConfig.variants}, (_, i) => i + 1);
    
    if (pendingExamConfig.hideTakenVariants) {
        const taken = getTakenVariants(pendingExamConfig.id);
        variants = variants.filter(v => !taken.includes(v));
    }
    
    return variants;
  };

  const variantOptions = getVariantOptions();

  if (isQuizStarted) {
     return (
      <div className="math-pattern min-h-screen flex flex-col font-sans text-slate-800">
         <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-2">
               <GraduationCap className="w-6 h-6 text-indigo-600" />
               <div className="flex flex-col"><span className="font-bold text-slate-800 hidden sm:block leading-tight">Học toán cùng T.Bình</span>{studentInfo && <span className="text-xs text-slate-500 font-medium">{studentInfo.name}</span>}</div>
            </div>
            <div className="flex items-center gap-4">
              {timeLeft > 0 && !isSubmitted && <div className={`flex items-center gap-2 font-mono text-xl font-bold ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}><Clock className="w-5 h-5" />{formatTime(timeLeft)}</div>}
              {!isSubmitted ? <button type="button" onClick={handleSubmit} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Nộp Bài</button> : <button type="button" onClick={handleReset} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><LogOut className="w-4 h-4" /> Thoát</button>}
            </div>
         </header>
        <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col justify-center">
          {showResults ? (
            <ResultStats questions={quizQuestions} userAnswers={userAnswers} studentInfo={studentInfo} allowReview={currentExamAllowReview} onRestart={handleReset} onReview={() => { setShowResults(false); setCurrentIndex(0); }} onSave={handleSaveResult} />
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 text-sm font-medium text-slate-500 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">Câu {currentIndex + 1} / {quizQuestions.length}</span>
                {isSubmitted && <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-1 text-xs uppercase"><LayoutDashboard className="w-3 h-3" /> Xem lại</span>}
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mb-8 overflow-hidden"><div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / quizQuestions.length) * 100}%` }} /></div>
              {currentQuestion && <QuizCard key={currentQuestion.id} question={currentQuestion} selectedAnswer={userAnswers[currentQuestion.id] || null} isSubmitted={isSubmitted} onAnswer={handleAnswer} onAskAI={() => setIsTutorOpen(true)} isExamMode={!!studentInfo} />}
              <div className="flex flex-wrap justify-between items-center mt-8 max-w-3xl mx-auto w-full gap-4">
                <button type="button" onClick={() => setCurrentIndex(c => Math.max(0, c - 1))} disabled={currentIndex === 0} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:shadow-sm disabled:opacity-30 transition-all font-medium"><ChevronLeft className="w-5 h-5" /> Câu Trước</button>
                <div className="flex-1 flex justify-center w-full sm:w-auto">{isSubmitted && <button type="button" onClick={() => setShowResults(true)} className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md font-medium"><BarChart2 className="w-5 h-5" /> Xem Kết Quả</button>}</div>
                <button type="button" onClick={() => setCurrentIndex(c => Math.min(quizQuestions.length - 1, c + 1))} disabled={currentIndex === quizQuestions.length - 1} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-30 transition-all shadow-md font-medium">Câu Sau <ChevronRight className="w-5 h-5" /></button>
              </div>
            </>
          )}
        </main>
        {currentQuestion && <AITutor isOpen={isTutorOpen} onClose={() => setIsTutorOpen(false)} question={currentQuestion} userAnswer={userAnswers[currentQuestion.id] || null}/>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white"><GraduationCap className="w-6 h-6" /></div>
          <div><h1 className="text-lg font-bold text-slate-800 leading-tight">Học toán cùng T.Bình</h1><p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Hệ thống ôn tập & thi</p></div>
        </div>
        
        <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
               <button type="button" onClick={() => setActiveTab('review')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'review' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} disabled={reviewQuestions.length === 0}><div className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> Ôn Tập</div></button>
               <button type="button" onClick={() => setActiveTab('exam')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'exam' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} disabled={examQuestions.length === 0}><div className="flex items-center gap-2"><FileText className="w-4 h-4" /> Làm Bài Thi</div></button>
            </nav>
            
            {/* Hidden Admin Access */}
            <button 
                onClick={() => setActiveTab('admin')}
                className={`p-2 rounded-full transition-colors ml-2 ${activeTab === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                title="Giáo viên"
            >
                <Lock className="w-4 h-4" />
            </button>
        </div>
      </header>
      
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-40">
         <button type="button" onClick={() => setActiveTab('review')} disabled={reviewQuestions.length === 0} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-full ${activeTab === 'review' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><LayoutDashboard className="w-5 h-5" /> <span className="text-[10px] font-bold">Ôn Tập</span></button>
         <button type="button" onClick={() => setActiveTab('exam')} disabled={examQuestions.length === 0} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-full ${activeTab === 'exam' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><FileText className="w-5 h-5" /> <span className="text-[10px] font-bold">Thi</span></button>
      </nav>

      <main className="flex-1 p-4 pb-24 md:pb-6 max-w-5xl mx-auto w-full">
        {loading && activeTab !== 'admin' ? <div className="flex flex-col items-center justify-center h-64"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div><p className="text-slate-500">Đang tải dữ liệu...</p></div> : (
          <>
             {activeTab === 'review' && (
               <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                     <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-indigo-600" /> Cấu hình bài ôn tập</h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="space-y-1"><label className="text-xs font-semibold text-slate-500 uppercase">Lớp</label><select value={filters.lop} onChange={(e) => setFilters({ ...filters, lop: e.target.value, chuDe: '', bai: '' })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"><option value="">Tất cả các lớp</option>{availableClasses.map(c => <option key={c} value={c}>Lớp {c}</option>)}</select></div>
                        <div className="space-y-1"><label className="text-xs font-semibold text-slate-500 uppercase">Chủ đề</label><select value={filters.chuDe} onChange={(e) => setFilters({ ...filters, chuDe: e.target.value, bai: '' })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"><option value="">Tất cả chủ đề</option>{availableTopics.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div className="space-y-1"><label className="text-xs font-semibold text-slate-500 uppercase">Bài học</label><select value={filters.bai} onChange={(e) => setFilters({ ...filters, bai: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none disabled:opacity-50" disabled={!filters.chuDe}><option value="">Tất cả bài học</option>{availableLessons.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 border-t border-slate-100 pt-6">
                        <div className="space-y-1"><label className="text-xs font-semibold text-slate-500 uppercase">Thời gian</label><div className="flex gap-2"><select value={selectedTimeOption} onChange={(e) => setSelectedTimeOption(Number(e.target.value))} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none">{TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>{selectedTimeOption === -1 && <input type="number" min="1" value={customTimeInput} onChange={(e) => setCustomTimeInput(e.target.value)} className="w-24 px-2 py-2 border border-slate-200 rounded-lg outline-none" />}</div></div>
                        <div className="space-y-1"><label className="text-xs font-semibold text-slate-500 uppercase">Số câu</label><select value={selectedCountOption} onChange={(e) => setSelectedCountOption(Number(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none">{COUNT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                     </div>
                     <div className="mb-6"><label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit"><input type="checkbox" checked={isShuffleEnabled} onChange={(e) => setIsShuffleEnabled(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/><span className="flex items-center gap-2 font-medium"><Shuffle className="w-4 h-4 text-slate-500" /> Tự động xáo trộn câu hỏi và đáp án</span></label></div>
                     <button onClick={handleStartReview} disabled={poolQuestions.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"><Play className="w-5 h-5 fill-current" /> Bắt đầu ôn tập ngay</button>
                  </div>
                  
                  {/* Footer Stats Refresh */}
                  <div className="text-center">
                      <button onClick={handleManualRefresh} className="text-xs text-slate-400 hover:text-indigo-600 underline flex items-center justify-center gap-1 mx-auto">
                          <Clock className="w-3 h-3"/> Cập nhật dữ liệu mới nhất
                      </button>
                  </div>
               </div>
             )}
             
             {activeTab === 'exam' && (
               <div className="animate-in slide-in-from-bottom-4 duration-300">
                  {!loggedInStudent ? (
                    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 mt-10">
                       <div className="text-center mb-6">
                          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                             <User className="w-8 h-8"/>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-800">Đăng Nhập Thi</h2>
                          <p className="text-slate-500 mt-1">Vui lòng nhập tài khoản được cấp</p>
                       </div>
                       
                       <form onSubmit={handleStudentLogin} className="space-y-4">
                          <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Mã học sinh / ID</label>
                             <div className="relative">
                               <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg outline-none focus:border-indigo-500" placeholder="Nhập ID..."/>
                               <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                             </div>
                          </div>
                          <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                             <div className="relative">
                               <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg outline-none focus:border-indigo-500" placeholder="Nhập mật khẩu..."/>
                               <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                             </div>
                          </div>
                          
                          {loginError && <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded">{loginError}</div>}
                          
                          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-all shadow-md">Đăng Nhập</button>
                       </form>
                       <div className="mt-4 text-center text-xs text-slate-400">Nếu quên mật khẩu, vui lòng liên hệ giáo viên.</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                         <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Thí sinh</div>
                            <div className="text-lg font-bold text-slate-800">{loggedInStudent.name}</div>
                            <div className="text-sm text-indigo-600 font-medium">{loggedInStudent.className}</div>
                         </div>
                         <button onClick={handleStudentLogout} className="text-sm text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors font-medium">Đăng xuất</button>
                      </div>

                      <div className="flex justify-between items-center mb-4">
                         <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Timer className="w-6 h-6 text-red-500" /> Danh sách bài thi đang mở</h2>
                         <button onClick={handleManualRefresh} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><Clock className="w-3 h-3"/> Cập nhật danh sách</button>
                      </div>
                      
                      {createdExams.length === 0 ? <div className="text-center p-12 bg-white rounded-2xl border border-slate-200"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-slate-400" /></div><h3 className="text-lg font-medium text-slate-700">Hiện chưa có bài thi nào</h3></div> : (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{createdExams.map((exam) => (
                            <div key={exam.id} onClick={() => handlePrepareExam(exam)} className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 cursor-pointer p-6 rounded-2xl shadow-sm transition-all group">
                               <div className="flex items-start justify-between mb-4"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><FileText className="w-6 h-6" /></div><span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> {exam.date}</span></div>
                               <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-indigo-700 line-clamp-2">{exam.title}</h3>
                               <div className="flex items-center gap-3 text-xs font-medium text-slate-400"><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {exam.duration} phút</span><span className="flex items-center gap-1"><FileQuestion className="w-3 h-3" /> {exam.questionCount} câu</span></div>
                            </div>
                         ))}</div>
                      )}
                    </>
                  )}
               </div>
             )}
             
             {activeTab === 'admin' && (
               <div className="animate-in slide-in-from-bottom-4 duration-300">
                  <AdminPanel reviewQuestions={reviewQuestions} examQuestions={examQuestions} createdExams={createdExams} submissions={submissions} onDataUpdate={handleDataUpdate} onCreateExam={handleCreateExam} onDeleteExam={handleDeleteExam} onClearExams={handleClearExams} onClearSubmissions={handleClearSubmissions} reviewSheetLink={REVIEW_SHEET_LINK} examSheetLink={EXAM_SHEET_LINK}/>
               </div>
             )}
          </>
        )}
      </main>

      {showVariantModal && pendingExamConfig && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
               <h3 className="text-xl font-bold text-slate-800 mb-4 text-center">Chọn Mã Đề Thi</h3>
               <div className="mb-4 text-center text-slate-500 text-sm">Bài thi này có nhiều mã đề khác nhau. Vui lòng chọn một mã đề để bắt đầu.</div>
               
               <div className="space-y-4">
                  {variantOptions.length === 0 ? (
                      <div className="text-red-500 text-sm p-3 bg-red-50 rounded border border-red-200 text-center">
                          Bạn đã hoàn thành tất cả các mã đề khả dụng trên thiết bị này.
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 gap-3">
                          {variantOptions.map(v => (
                              <button 
                                key={v}
                                onClick={() => handleStartExam(v)}
                                className="p-3 border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 rounded-lg font-bold text-slate-700 hover:text-indigo-700 transition-all"
                              >
                                  Đề số {v}
                              </button>
                          ))}
                      </div>
                  )}
               </div>
               <button onClick={() => setShowVariantModal(false)} className="mt-6 w-full py-2 text-slate-500 hover:text-slate-800 font-medium">Hủy bỏ</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
