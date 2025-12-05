
export interface Question {
  id: string;
  lop: string;       // Class
  chuDe: string;     // Topic
  bai: string;       // Lesson
  cauHoi: string;    // Question Text
  linkAnh?: string;  // Image URL
  dapAnA: string;
  dapAnB: string;
  dapAnC: string;
  dapAnD: string;
  dapAnDung: 'A' | 'B' | 'C' | 'D'; // Correct Answer
  goiY: string;      // Hint
  loiGiai: string;   // Detailed Solution
  mucDo?: string;    // NEW: Level (Biết, Hiểu, Vận dụng)
}

export interface FilterState {
  lop: string;
  chuDe: string;
  bai: string;
}

export interface QuizState {
  questions: Question[];
  filteredQuestions: Question[];
  currentIndex: number;
  score: number;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>; // questionId -> selectedAnswer
  isReviewing: boolean; // If true, showing answer/solution
}

export interface AIResponseState {
  loading: boolean;
  content: string | null;
  error: string | null;
}

// NEW: Define a section within an exam (e.g., "5 Easy questions from Algebra")
export interface ExamSection {
  id: string;
  targetClass: string;
  selectedTopic: string;
  selectedLesson: string;
  countBiet: number;    // Knowledge
  countHieu: number;    // Understanding
  countVanDung: number; // Application
}

export interface ExamConfig {
  id: string;
  title: string;
  date: string;       // ISO Date string
  duration: number;   // Minutes
  
  // New Structure: A list of sections instead of single filters
  sections: ExamSection[]; 
  
  // Backward compatibility fields (optional now)
  questionCount?: number;
  targetClass?: string;
  selectedTopic?: string;
  selectedLesson?: string;

  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  allowDuplicates: boolean; 
  allowReview: boolean;
  variants: number; 
  hideTakenVariants?: boolean; // NEW: Hide variants that have been taken on this device
  createdAt: number;
}

export interface StudentSubmission {
  id: string;
  studentName: string;
  className: string;
  examId: string;
  examTitle: string;
  score: number;        // Điểm thang 10
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;  // ISO string
}

export interface StudentAccount {
  id: string;       // Mã học sinh / ID đăng nhập
  password: string; // Mật khẩu
  name: string;     // Họ tên
  className: string;// Lớp
}

export interface CurriculumItem {
  lop: string;
  chuDe: string;
  bai: string;
}
