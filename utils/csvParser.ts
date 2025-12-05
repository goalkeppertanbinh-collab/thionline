
import { Question, StudentAccount, CurriculumItem, ExamConfig } from '../types';

// Robust delimiter detector
const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine) return ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
};

const splitLineWithDelimiter = (line: string, delimiter: string): string[] => {
    const res: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === delimiter && !inQuote) {
        res.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        current = '';
      } else {
        current += char;
      }
    }
    res.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return res;
};

export const parseQuestionsFromCSV = (csvText: string): Question[] => {
  const content = csvText.replace(/^\uFEFF/, '').trim(); // Remove BOM
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return [];

  const delimiter = detectDelimiter(content);
  
  // Skip header if found
  let headerIndex = -1;
  const keywords = ['câu hỏi', 'cau hoi', 'question', 'đáp án', 'dap an', 'lớp', 'lop'];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter).map(c => c.toLowerCase());
    if (cols.some(c => keywords.some(k => c.includes(k)))) {
      headerIndex = i;
      break;
    }
  }

  // --- STRICT MAPPING THEO FILE MẪU GOOGLE SHEET ---
  const questions: Question[] = [];
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter);
    
    // Skip rows with too few columns. We need at least up to Question (Index 4)
    if (cols.length < 5) continue; 

    // Helper to safely get column content
    const get = (index: number) => (cols[index] || '').trim();

    // Skip "ghost" rows where Question is empty
    if (!get(4)) continue;

    const normalizeAnswer = (ans: string): 'A' | 'B' | 'C' | 'D' => {
      if (!ans) return 'A';
      const u = ans.toUpperCase().trim();
      const char = u.charAt(0);
      return ['A', 'B', 'C', 'D'].includes(char) ? (char as 'A'|'B'|'C'|'D') : 'A';
    };

    questions.push({
      id: `q-${i}`,
      lop: get(0),       // Cột A
      chuDe: get(1),     // Cột B
      bai: get(2),       // Cột C
      mucDo: get(3),     // Cột D
      cauHoi: get(4),    // Cột E
      linkAnh: get(5),   // Cột F
      dapAnA: get(6),    // Cột G
      dapAnB: get(7),    // Cột H
      dapAnC: get(8),    // Cột I
      dapAnD: get(9),    // Cột J
      dapAnDung: normalizeAnswer(get(10)), // Cột K
      goiY: get(11),     // Cột L
      loiGiai: get(12),  // Cột M
    });
  }

  return questions;
};

export const parseCurriculumFromCSV = (csvText: string): CurriculumItem[] => {
  const content = csvText.replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 1) return [];

  const delimiter = detectDelimiter(content);

  let headerIndex = -1;
  let idxLop = -1;
  let idxChuDe = -1;
  let idxBai = -1;

  const kwLop = ['lớp', 'lop', 'khối', 'khoi', 'grade', 'class'];
  const kwChuDe = ['chủ đề', 'chu de', 'chương', 'chuong', 'topic', 'chapter', 'chuyên đề'];
  const kwBai = ['bài', 'bai', 'tên bài', 'ten bai', 'bài học', 'lesson', 'unit'];

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter).map(c => c.toLowerCase().normalize('NFC').trim());
    
    const l = cols.findIndex(c => kwLop.some(k => c.includes(k)));
    const cd = cols.findIndex(c => kwChuDe.some(k => c.includes(k)));
    const b = cols.findIndex(c => kwBai.some(k => c === k || c.startsWith(k + ' ') || c.endsWith(' ' + k)));

    if (l !== -1 && (cd !== -1 || b !== -1)) {
      headerIndex = i;
      idxLop = l;
      idxChuDe = cd;
      idxBai = b;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const items: CurriculumItem[] = [];
  const uniqueKeys = new Set<string>();

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter);
    const lop = idxLop !== -1 ? (cols[idxLop] || '') : '';
    const chuDe = idxChuDe !== -1 ? (cols[idxChuDe] || '') : '';
    const bai = idxBai !== -1 ? (cols[idxBai] || '') : '';

    if (chuDe || bai || lop) {
       const cleanLop = lop.trim();
       const cleanChuDe = chuDe.trim();
       const cleanBai = bai.trim();
       const key = `${cleanLop}|${cleanChuDe}|${cleanBai}`;
       if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          items.push({ lop: cleanLop, chuDe: cleanChuDe, bai: cleanBai });
       }
    }
  }
  return items;
};

export const parseStudentAccountsFromCSV = (csvText: string): StudentAccount[] => {
  const content = csvText.replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return [];

  const delimiter = detectDelimiter(content);

  let headerIndex = -1;
  const kwID = ['id', 'mã', 'user', 'tài khoản'];
  const kwPass = ['pass', 'mật khẩu', 'password', 'mk'];
  const kwName = ['tên', 'name', 'họ tên'];
  const kwClass = ['lớp', 'class', 'lop'];

  let idxID = -1, idxPass = -1, idxName = -1, idxClass = -1;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter).map(c => c.toLowerCase());
    const id = cols.findIndex(c => kwID.some(k => c.includes(k)));
    const pass = cols.findIndex(c => kwPass.some(k => c.includes(k)));
    
    if (id !== -1 && pass !== -1) {
      headerIndex = i;
      idxID = id;
      idxPass = pass;
      idxName = cols.findIndex(c => kwName.some(k => c.includes(k)));
      idxClass = cols.findIndex(c => kwClass.some(k => c.includes(k)));
      break;
    }
  }

  const accounts: StudentAccount[] = [];
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;
  
  if (headerIndex === -1) {
    idxID = 0; idxPass = 1; idxName = 2; idxClass = 3;
  }

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter);
    if (cols.length < 2) continue;
    
    accounts.push({
      id: (cols[idxID] || '').trim(),
      password: (cols[idxPass] || '').trim(),
      name: idxName !== -1 ? (cols[idxName] || '').trim() : 'Học sinh',
      className: idxClass !== -1 ? (cols[idxClass] || '').trim() : ''
    });
  }
  return accounts;
};

// NEW: CORRECTLY PARSE EXAMS
export const parseExamsFromCSV = (csvText: string): ExamConfig[] => {
  const content = csvText.replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return [];
  
  const delimiter = detectDelimiter(content);
  
  // Headers for detection
  let headerIndex = -1;
  const kwID = ['id', 'mã đề'];
  const kwTitle = ['tên', 'tiêu đề', 'title'];
  const kwStruct = ['cấu trúc', 'json', 'structure'];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
     const cols = splitLineWithDelimiter(lines[i], delimiter).map(c => c.toLowerCase());
     if (cols.some(c => kwTitle.some(k => c.includes(k))) && cols.some(c => kwStruct.some(k => c.includes(k)))) {
         headerIndex = i;
         break;
     }
  }

  // Define indexes based on the Copy/Paste format from AdminPanel
  // ID | Title | Date | Duration | Variants | StructureJSON | Status
  // If header found, we can try to map dynamically, but let's default to fixed structure 
  // if header is missing or looks like the standard export.
  
  let idxID = 0, idxTitle = 1, idxDate = 2, idxDur = 3, idxVar = 4, idxStruct = 5, idxStatus = 6;

  if (headerIndex !== -1) {
      const cols = splitLineWithDelimiter(lines[headerIndex], delimiter).map(c => c.toLowerCase());
      // Re-map if possible, otherwise keep defaults
      const fTitle = cols.findIndex(c => kwTitle.some(k => c.includes(k)));
      const fStruct = cols.findIndex(c => kwStruct.some(k => c.includes(k)));
      if (fTitle !== -1) idxTitle = fTitle;
      if (fStruct !== -1) idxStruct = fStruct;
      // ... assume relative positions or fixed for others
  }

  const exams: ExamConfig[] = [];
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
      const cols = splitLineWithDelimiter(lines[i], delimiter);
      if (cols.length < 4) continue;

      const id = (cols[idxID] || `exam-${i}`).trim();
      const title = (cols[idxTitle] || 'Bài thi không tên').trim();
      // Skip if it looks like a header repetition
      if (title.toLowerCase().includes('tên kỳ thi')) continue;

      const dateRaw = (cols[idxDate] || '').trim();
      // If date is empty, default to today
      // Attempt to normalize date DD/MM/YYYY to YYYY-MM-DD if needed, but let's trust ISO or simple string
      let date = dateRaw;
      if (dateRaw.includes('/')) {
         const parts = dateRaw.split('/');
         if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD
      }

      const duration = parseInt((cols[idxDur] || '45').trim()) || 45;
      const variants = parseInt((cols[idxVar] || '1').trim()) || 1;
      const rawStruct = (cols[idxStruct] || '[]').trim();
      const status = (cols[idxStatus] || 'Open').trim();

      if (status.toLowerCase() === 'closed') continue;

      let sections = [];
      try {
          // Replace simple quotes with double quotes if needed, though JSON should be standard
          // Sometimes CSV export doubles quotes
          let cleanJson = rawStruct;
          // If CSV parser handled double quotes correctly, cleanJson is the content.
          // But sometimes people paste raw text.
          if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
             cleanJson = cleanJson.slice(1, -1).replace(/""/g, '"');
          }
          sections = JSON.parse(cleanJson);
      } catch (e) {
          console.warn(`Failed to parse exam structure for ${title}`, e);
          sections = [];
      }

      // Calculate total questions
      const qCount = Array.isArray(sections) 
        ? sections.reduce((acc: number, s: any) => acc + (s.countBiet||0) + (s.countHieu||0) + (s.countVanDung||0), 0)
        : 0;

      exams.push({
          id,
          title,
          date,
          duration,
          variants,
          sections,
          questionCount: qCount,
          targetClass: 'Mixed',
          shuffleQuestions: true,
          shuffleAnswers: true,
          allowDuplicates: false,
          allowReview: true,
          hideTakenVariants: false,
          createdAt: Date.now()
      });
  }

  return exams;
};

export const SAMPLE_DATA = `Lớp,Chủ đề,Bài,Mức độ,Câu hỏi,Link ảnh,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng,Gợi ý,Lời giải chi tiết
12,Hàm số,Cực trị,Biết,Cho hàm số $y = x^3 - 3x + 1$. Số điểm cực trị của hàm số là:,,0,1,2,3,C,Tính đạo hàm y'.,y' = 3x^2 - 3. y' = 0 <=> x = 1 hoặc x = -1.
12,Hàm số,Đồng biến nghịch biến,Hiểu,Hàm số nào sau đây đồng biến trên R?,,$y = x^3 + x$,$y = x^2 + 1$,$y = (x-1)/(x+1)$,$y = x^4 + x^2$,A,Tính y' và xét dấu.,y' = 3x^2 + 1 > 0 với mọi x.
12,Logarit,Phương trình logarit,Vận dụng,Nghiệm của phương trình $\\log_2(x) = 3$ là:,,x = 9,x = 8,x = 6,x = 5,B,Dùng định nghĩa logarit.,x = 2^3 = 8.
`;
