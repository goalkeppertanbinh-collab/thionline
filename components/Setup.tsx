import React, { useState } from 'react';
import { FileSpreadsheet, Play, Database, AlertTriangle, HelpCircle } from 'lucide-react';
import { SAMPLE_DATA, parseQuestionsFromCSV } from '../utils/csvParser';
import { Question } from '../types';

interface SetupProps {
  onDataLoaded: (questions: Question[]) => void;
}

// --- CẤU HÌNH: ĐIỀN LINK GOOGLE SHEET CỦA BẠN VÀO DƯỚI ĐÂY ---
// Ví dụ: "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit..."
// Lưu ý: File phải được "Publish to Web" (Tệp > Chia sẻ > Công bố lên web)
const MY_GOOGLE_SHEET_LINK = "https://docs.google.com/spreadsheets/d/1RSJ_7BWPjez8Ui78tuEap0CPAY9hGfRaCFiz8odrKiQ/edit?gid=0#gid=0"; 
// -------------------------------------------------------------

const Setup: React.FC<SetupProps> = ({ onDataLoaded }) => {
  const [url, setUrl] = useState(MY_GOOGLE_SHEET_LINK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoadSample = () => {
    const q = parseQuestionsFromCSV(SAMPLE_DATA);
    onDataLoaded(q);
  };

  const handleFillDemoLink = () => {
    const csvContent = SAMPLE_DATA;
    const encoded = encodeURIComponent(csvContent);
    const dataUrl = `data:text/csv;charset=utf-8,${encoded}`;
    setUrl(dataUrl);
    setError('');
  };

  const processGoogleSheetUrl = (inputUrl: string) => {
    try {
      if (!inputUrl) return '';
      if (inputUrl.startsWith('data:')) return inputUrl;

      // Extract ID from Google Sheet URL (covers /edit, /view, etc.)
      const idMatch = inputUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      
      if (idMatch && idMatch[1]) {
        const spreadsheetId = idMatch[1];
        // Convert to CSV export URL
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      }
      
      return inputUrl;
    } catch (e) {
      return inputUrl;
    }
  };

  const handleLoadUrl = async () => {
    if (!url) return;
    setLoading(true);
    setError('');

    const processedUrl = processGoogleSheetUrl(url);

    try {
      const response = await fetch(processedUrl);
      
      if (!response.ok) {
         if (response.status === 404) throw new Error('Không tìm thấy file (404). Hãy kiểm tra lại đường dẫn.');
         if (response.status === 302 || response.status === 0) throw new Error('Lỗi truy cập. Hãy đảm bảo file đã "Publish to web".');
         throw new Error(`Lỗi tải dữ liệu (${response.status}).`);
      }
      
      const text = await response.text();
      const decodedText = processedUrl.startsWith('data:') ? decodeURIComponent(text) : text;
      
      // Basic validation of content
      if (!decodedText || decodedText.length < 10) {
           // Sometimes Google returns a login page HTML instead of CSV
           if (decodedText.includes('<!DOCTYPE html>')) {
               throw new Error('Link trả về trang HTML thay vì CSV. Vui lòng kiểm tra lại "Publish to web".');
           }
           throw new Error('Dữ liệu tải về trống hoặc không hợp lệ.');
      }

      const questions = parseQuestionsFromCSV(decodedText);
      if (questions.length === 0) throw new Error('Không tìm thấy câu hỏi nào trong file (hoặc sai định dạng cột).');
      
      onDataLoaded(questions);
    } catch (err) {
      console.error(err);
      let msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      
      // Generic "Failed to fetch" usually means CORS
      if (msg.includes('Failed to fetch')) {
          msg = '🛑 Lỗi kết nối (CORS): Google chặn truy cập. Hãy vào "Tệp > Chia sẻ > Công bố lên web" (File > Share > Publish to web) trên Google Sheet.';
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-100 p-4 rounded-full">
            <FileSpreadsheet className="w-10 h-10 text-indigo-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">
          Cài Đặt Dữ Liệu
        </h1>
        <p className="text-slate-500 text-center mb-8 text-sm">
          Nhập link Google Sheet hoặc dùng dữ liệu mẫu.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Link Google Sheet
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Dán link Google Sheet của bạn vào đây..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all pr-24 text-sm"
              />
              <button 
                onClick={handleFillDemoLink}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
                title="Sử dụng link ảo để test tính năng tải"
              >
                Link Mẫu
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <button
            onClick={handleLoadUrl}
            disabled={loading || !url}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform active:scale-[0.98]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Database className="w-4 h-4" />
                Tải Dữ Liệu
              </>
            )}
          </button>

          {/* Instructions Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h4 className="font-semibold text-blue-800 text-sm mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Cách sửa lỗi "Failed to fetch":
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-blue-700">
              <li>
                Mở Google Sheet của bạn.
              </li>
              <li>
                Chọn <b>File (Tệp)</b> &rarr; <b>Share (Chia sẻ)</b> &rarr; <b>Publish to web (Công bố lên web)</b>.
              </li>
              <li>
                Trong hộp thoại hiện ra, nhấn nút <b>Publish (Công bố)</b>.
              </li>
              <li>
                Copy link file (từ thanh địa chỉ hoặc link công bố) rồi dán vào đây. App sẽ tự xử lý đuôi <code>/export...</code> cho bạn.
              </li>
            </ol>
          </div>

          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center pt-2">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase pt-2">
              <span className="bg-white px-2 text-slate-500">Hoặc</span>
            </div>
          </div>

          <button
            onClick={handleLoadSample}
            className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            Dùng Dữ Liệu Demo Có Sẵn
          </button>
        </div>
      </div>
    </div>
  );
};

export default Setup;