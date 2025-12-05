
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
  
  // Default indices (Standard Template)
  // 0:Lop, 1:ChuDe, 2:Bai, 3:MucDo, 4:CauHoi, 5:LinkAnh, 6:A, 7:B, 8:C, 9:D, 10:Dung, 11:GoiY, 12:LoiGiai
  let idxLop = 0, idxChuDe = 1, idxBai = 2, idxMucDo = 3, idxCauHoi = 4, idxLinkAnh = 5;
  let idxA = 6, idxB = 7, idxC = 8, idxD = 9, idxDung = 10, idxGoiY = 11, idxLoiGiai = 12;

  // Detect Header Row
  let headerIndex = -1;
  const keywords = ['câu hỏi', 'cau hoi', 'question', 'đáp án', 'dap an', 'lớp', 'lop'];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter).map(c => c.toLowerCase());
    if (cols.some(c => keywords.some(k => c.includes(k)))) {
      headerIndex = i;
      
      // Dynamic Column Mapping
      const find = (kws: string[]) => cols.findIndex(c => kws.some(k => c.includes(k)));
      
      const _lop = find(['lớp', 'lop', 'class']);
      const _chuDe = find(['chủ đề', 'chu de', 'topic', 'chương']);
      const _bai = find(['bài', 'bai', 'lesson', 'tên bài']);
      const _mucDo = find(['mức độ', 'muc do', 'level']);
      const _cauHoi = find(['câu hỏi', 'cau hoi', 'question', 'nội dung']);
      const _linkAnh = find(['link ảnh', 'link anh', 'image', 'hình']);
      
      // Answers can be tricky. Look for "Đáp án A" specifically or just "A" if strict
      const _a = find(['đáp án a', 'dap an a']); 
      const _b = find(['đáp án b', 'dap an b']);
      const _c = find(['đáp án c', 'dap an c']);
      const _d = find(['đáp án d', 'dap an d']);
      
      const _dung = find(['đáp án đúng', 'dap an dung', 'correct', 'đáp án']); // "đáp án" might match "đáp án a", check order/uniqueness if needed, but usually specific headers exist
      
      // Refine _dung: if it matched "đáp án a", look for "đúng"
      const _dungStrict = cols.findIndex(c => (c.includes('đáp án') || c.includes('dap an')) && (c.includes('đúng') || c.includes('dung')));
      
      const _goiY = find(['gợi ý', 'goi y', 'hint']);
      const _loiGiai = find(['lời giải', 'loi giai', 'solution', 'chi tiết']);

      if (_lop !== -1) idxLop = _lop;
      if (_chuDe !== -1) idxChuDe = _chuDe;
      if (_bai !== -1) idxBai = _bai;
      if (_mucDo !== -1) idxMucDo = _mucDo;
      if (_cauHoi !== -1) idxCauHoi = _cauHoi;
      if (_linkAnh !== -1) idxLinkAnh = _linkAnh;
      
      if (_a !== -1) idxA = _a;
      if (_b !== -1) idxB = _b;
      if (_c !== -1) idxC = _c;
      if (_d !== -1) idxD = _d;
      
      if (_dungStrict !== -1) idxDung = _dungStrict;
      else if (_dung !== -1 && _dung !== _a) idxDung = _dung; // Fallback if strict not found

      if (_goiY !== -1) idxGoiY = _goiY;
      if (_loiGiai !== -1) idxLoiGiai = _loiGiai;

      break;
    }
  }

  const questions: Question[] = [];
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitLineWithDelimiter(lines[i], delimiter);
    
    // Helper to safely get column content
    const get = (index: number) => (cols[index] || '').trim();

    // Skip "ghost" rows where Question is empty
    const qContent = get(idxCauHoi);
    if (!qContent) continue;

    const normalizeAnswer = (ans: string): 'A' | 'B' | 'C' | 'D' => {
      if (!ans) return 'A';
      const u = ans.toUpperCase().trim();
      // Sometimes answer is "A. Value", extract first char
      const char = u.charAt(0);
      return ['A', 'B', 'C', 'D'].includes(char) ? (char as 'A'|'B'|'C'|'D') : 'A';
    };

    questions.push({
      id: `q-${i}`,
      lop: get(idxLop),
      chuDe: get(idxChuDe),
      bai: get(idxBai),
      mucDo: get(idxMucDo),
      cauHoi: qContent,
      linkAnh: get(idxLinkAnh),
      dapAnA: get(idxA),
      dapAnB: get(idxB),
      dapAnC: get(idxC),
      dapAnD: get(idxD),
      dapAnDung: normalizeAnswer(get(idxDung)),
      goiY: get(idxGoiY),
      loiGiai: get(idxLoiGiai),
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
  let idxID = 0, idxTitle = 1, idxDate = 2, idxDur = 3, idxVar = 4, idxStruct = 5, idxStatus = 6;

  if (headerIndex !== -1) {
      const cols = splitLineWithDelimiter(lines[headerIndex], delimiter).map(c => c.toLowerCase());
      // Re-map if possible, otherwise keep defaults
      const fTitle = cols.findIndex(c => kwTitle.some(k => c.includes(k)));
      const fStruct = cols.findIndex(c => kwStruct.some(k => c.includes(k)));
      if (fTitle !== -1) idxTitle = fTitle;
      if (fStruct !== -1) idxStruct = fStruct;
      
      const fDate = cols.findIndex(c => c.includes('ngày') || c.includes('date'));
      if (fDate !== -1) idxDate = fDate;
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
