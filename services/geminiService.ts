
import { GoogleGenAI } from "@google/genai";
import { Question } from "../types";

// Helper to get client safely without crashing in browser/Vercel environments
const getClient = (customKey?: string) => {
  let envKey = '';
  // Check if 'process' exists before accessing it (prevents "process is not defined" error on Vercel/Browser)
  try {
    if (typeof process !== 'undefined' && process.env) {
      envKey = process.env.API_KEY || '';
    }
  } catch (e) {
    // Ignore error if process is undefined
  }

  const apiKey = customKey ? customKey.trim() : envKey;
  if (!apiKey) throw new Error("Chưa nhập API Key. Vui lòng nhập API Key trong tab 'AI Tạo Câu Hỏi'.");
  return new GoogleGenAI({ apiKey });
};

// Helper to clean JSON string before parsing
// Fixes "Bad escaped character" errors and preserves LaTeX structure
const cleanJsonResponse = (text: string): string => {
  if (!text) return "";
  
  // Remove markdown code blocks
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Robust character-by-character processing
  let res = "";
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '\\') {
      const next = clean[i+1];
      
      // 1. Preserve valid JSON escapes (only common ones)
      // Note: We EXCLUDE \b (backspace) and \f (form feed) because they are common in LaTeX (\beta, \frac)
      // We want \frac to become \\frac (literal backslash), not \f (form feed control char)
      if (next === '"' || next === '\\' || next === '/' || next === 'n' || next === 'r' || next === 't') {
        res += char + next;
        i++;
        continue;
      }
      
      // 2. Preserve valid Unicode escapes \uXXXX
      if (next === 'u') {
         const hex = clean.substr(i+2, 4);
         if (/^[0-9a-fA-F]{4}$/.test(hex)) {
           res += char + next + hex;
           i += 5;
           continue;
         }
      }
      
      // 3. For everything else (including \f, \b, \l, \s, etc.), escape the backslash.
      // This fixes LaTeX commands like \frac -> \\frac, \left -> \\left
      res += "\\\\"; 
    } else {
      res += char;
    }
  }
  
  return res;
};

// Robust Parser with Fallback
const safeJsonParse = (text: string): any => {
  // Try 1: Smart Clean
  const clean1 = cleanJsonResponse(text);
  try {
    return JSON.parse(clean1);
  } catch (e1) {
    // Try 2: Nuclear Option (Escape ALL backslashes)
    try {
      const rawBody = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const clean2 = rawBody.replace(/\\/g, "\\\\");
      return JSON.parse(clean2);
    } catch (e2) {
      console.error("Nuclear JSON clean failed:", e2);
      throw new Error("Không thể đọc dữ liệu JSON từ AI (Lỗi cấu trúc).");
    }
  }
};

export const explainQuestion = async (
  question: Question,
  userAnswer: string | null,
  topic: string
): Promise<string> => {
  try {
    // Note: Explanation might fail if API Key is not set in env. 
    // In Vercel static deploy, users typically can't set env vars easily for client-side.
    // Ideally, we should pass the key from context, but for now we try/catch.
    const ai = getClient(); 
    const model = "gemini-2.5-flash";

    const prompt = `
      Giải thích bài toán toán học.
      Câu hỏi: ${question.cauHoi}
      Đáp án đúng: ${question.dapAnDung}
      Lời giải gốc: ${question.loiGiai}
      
      Hãy giải thích chi tiết, từng bước, dễ hiểu. Dùng LaTeX trong dấu $ cho công thức.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Xin lỗi, tôi không thể tạo lời giải thích ngay lúc này.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Cần cấu hình API Key để sử dụng tính năng này.";
  }
};

export const generateQuizQuestions = async (
  topic: string,
  lesson: string,
  grade: string,
  count: number,
  difficulty: string,
  apiKey?: string,
  additionalPrompt?: string,
  sourceData?: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<Partial<Question>[]> => {
  try {
    const ai = getClient(apiKey);
    const model = "gemini-2.5-flash";

    const parts: any[] = [];

    if (sourceData?.imageBase64 && sourceData.mimeType) {
      parts.push({
        inlineData: {
          data: sourceData.imageBase64,
          mimeType: sourceData.mimeType,
        },
      });
    }

    const prompt = `
      Hãy đóng vai một giáo viên Toán xuất sắc.
      Nhiệm vụ: Tạo ${count} câu hỏi trắc nghiệm Toán lớp ${grade}.
      Chủ đề lớn: "${topic}".
      Bài học cụ thể: "${lesson}" (Nếu trống hãy tự chọn bài phù hợp trong chủ đề).
      Mức độ khó yêu cầu: "${difficulty}".
      
      ${sourceData?.text || (sourceData?.imageBase64) ? 
        `THÔNG TIN TÀI LIỆU NGUỒN CUNG CẤP (ƯU TIÊN TUYỆT ĐỐI):
         Hãy dựa vào nội dung văn bản dưới đây hoặc tài liệu đính kèm (Ảnh/PDF) để tạo ra các câu hỏi bám sát tài liệu này.
         ${sourceData.text ? `\n--- NỘI DUNG TÀI LIỆU ---\n${sourceData.text}\n--------------------------` : ''}
         ` 
         : ''
      }
      
      ${additionalPrompt ? `YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG: "${additionalPrompt}"` : ''}
      
      QUY TẮC ĐỊNH DẠNG TOÁN HỌC (BẮT BUỘC):
      1. Mọi công thức toán, biểu thức, phương trình, ký hiệu đặc biệt PHẢI được viết bằng mã LaTeX và bao quanh bởi dấu $.
      2. QUAN TRỌNG CHO JSON: Vì bạn trả về JSON, các dấu gạch chéo ngược (backslash) trong LaTeX phải được thoát hai lần (double escaped). 
         Ví dụ: Viết '\\\\frac{1}{2}' thay vì '\\frac{1}{2}', '\\\\Delta' thay vì '\\Delta'.
      3. Hãy cẩn thận với các ký tự đặc biệt như \\left, \\right, \\{, \\}. Chúng phải là \\\\left, \\\\right, \\\\{, \\\\}.

      Yêu cầu đầu ra JSON:
      - mucDo: Xác định mức độ cụ thể của câu hỏi (Biết, Hiểu, Vận dụng, Vận dụng cao).
      - cauHoi: Nội dung câu hỏi.
      - bai: Tên bài học.
      - dapAnA, dapAnB, dapAnC, dapAnD: Các phương án.
      - dapAnDung: CHỈ LẤY 1 KÝ TỰ DUY NHẤT là 'A', 'B', 'C', hoặc 'D'. TUYỆT ĐỐI KHÔNG ghi thêm lời giải thích.
      - loiGiai: Giải chi tiết ngắn gọn để ra kết quả đúng (KHÔNG phân tích các đáp án sai).
      - goiY: Gợi ý ngắn.
      - linkAnh: Mô tả hình vẽ nếu cần (trong ngoặc vuông), hoặc để trống.
    `;
    
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];

    const parsedData = safeJsonParse(text);
      
    const results = Array.isArray(parsedData) ? parsedData : [parsedData];
    return results.map((q: any) => ({
      ...q,
      mucDo: q.mucDo || difficulty,
      dapAnDung: ['A', 'B', 'C', 'D'].includes(q.dapAnDung?.toUpperCase()?.trim()?.charAt(0)) 
        ? q.dapAnDung.toUpperCase().trim().charAt(0) 
        : 'A'
    }));

  } catch (error: any) {
    console.error("Gemini Generate Error:", error);
    throw new Error("Lỗi tạo câu hỏi: " + (error.message || ""));
  }
};

export const extractQuestionsFromInput = async (
  inputData: { text?: string; imageBase64?: string; mimeType?: string },
  apiKey?: string
): Promise<Partial<Question>[]> => {
  try {
    const ai = getClient(apiKey);
    const model = "gemini-2.5-flash";

    const parts: any[] = [];
    
    if (inputData.imageBase64 && inputData.mimeType) {
      parts.push({
        inlineData: {
          data: inputData.imageBase64,
          mimeType: inputData.mimeType,
        },
      });
    }

    const textPrompt = `
      Bạn là một trợ lý nhập liệu Toán học thông minh.
      Nhiệm vụ: Phân tích nội dung (từ ảnh hoặc văn bản) và trích xuất thành danh sách câu hỏi trắc nghiệm.
      
      ${inputData.text ? `Nội dung văn bản cần xử lý: \n${inputData.text}` : ''}

      Yêu cầu xử lý:
      1. Tự động nhận diện Lớp, Chủ đề, Bài học, Mức độ dựa trên nội dung câu hỏi.
      2. Trích xuất chính xác nội dung câu hỏi, 4 đáp án và đáp án đúng.
      3. Nếu không tìm thấy lời giải chi tiết, hãy tự tạo ra lời giải ngắn gọn.
      4. QUAN TRỌNG: Tất cả công thức toán phải chuyển sang định dạng LaTeX bao quanh bởi dấu $.
      5. QUAN TRỌNG CHO JSON: Các dấu backslash trong LaTeX (như \\frac) phải được viết thành \\\\frac (2 dấu gạch) để đảm bảo JSON hợp lệ.
      
      Trả về JSON Array với đúng tên các trường sau:
      - lop, chuDe, bai, mucDo
      - cauHoi
      - dapAnA, dapAnB, dapAnC, dapAnD
      - dapAnDung (CHỈ 1 KÝ TỰ A/B/C/D)
      - loiGiai (Lời giải ngắn gọn, không giải thích đáp án sai)
      - goiY
      - linkAnh (Để trống)
    `;
    
    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];
    
    const parsedData = safeJsonParse(text);
    return Array.isArray(parsedData) ? parsedData : [parsedData];

  } catch (error: any) {
    console.error("Gemini Extract Error:", error);
    throw new Error("Lỗi khi trích xuất dữ liệu: " + (error.message || ""));
  }
};

export const generateSimilarQuestions = async (
  sampleQuestions: Partial<Question>[],
  count: number,
  apiKey?: string
): Promise<Partial<Question>[]> => {
  try {
    const ai = getClient(apiKey);
    const model = "gemini-2.5-flash";

    const samples = sampleQuestions.map(q => ({
      cauHoi: q.cauHoi,
      mucDo: q.mucDo,
      chuDe: q.chuDe,
      bai: q.bai,
      lop: q.lop
    }));

    const prompt = `
      Bạn là giáo viên Toán chuyên soạn đề thi.
      Dựa trên các câu hỏi mẫu sau đây, hãy tạo ra thêm ${count} câu hỏi TƯƠNG TỰ.
      
      DỮ LIỆU MẪU:
      ${JSON.stringify(samples, null, 2)}
      
      Yêu cầu:
      1. Tạo câu hỏi mới có cùng chủ đề, dạng bài và mức độ khó với mẫu.
      2. THAY ĐỔI số liệu, tham số hoặc ngữ cảnh để tạo thành bài toán mới (không được sao chép y nguyên).
      3. Giữ nguyên định dạng Lớp, Chủ đề, Bài, Mức độ của các câu mẫu.
      4. Sử dụng định dạng LaTeX trong dấu $ cho công thức toán.
      5. QUAN TRỌNG: Output JSON phải hợp lệ. Các ký tự \`\\\` trong LaTeX phải được thoát thành \`\\\\ \` (ví dụ \`\\\\frac\`, \`\\\\Delta\`).
      
      Định dạng đầu ra JSON bắt buộc:
      - lop, chuDe, bai, mucDo
      - cauHoi
      - dapAnA, dapAnB, dapAnC, dapAnD
      - dapAnDung (Chỉ 1 ký tự A/B/C/D)
      - loiGiai (Lời giải chi tiết ngắn gọn cho bài toán mới, không giải thích đáp án sai)
      - goiY
      - linkAnh (Để trống)
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];
    
    const parsedData = safeJsonParse(text);
    const results = Array.isArray(parsedData) ? parsedData : [parsedData];
      
    return results.map((q: any) => ({
      ...q,
      dapAnDung: ['A', 'B', 'C', 'D'].includes(q.dapAnDung?.toUpperCase()?.trim()?.charAt(0)) 
        ? q.dapAnDung.toUpperCase().trim().charAt(0) 
        : 'A'
    }));

  } catch (error: any) {
    console.error("Gemini Similar Gen Error:", error);
    throw new Error("Lỗi khi tạo câu hỏi tương tự: " + (error.message || ""));
  }
};
