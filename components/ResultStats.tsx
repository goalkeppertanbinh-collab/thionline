
import React, { useEffect, useRef } from 'react';
import { Question } from '../types';
import { CheckCircle, XCircle, AlertCircle, RotateCcw, Eye, User, GraduationCap, EyeOff } from 'lucide-react';

interface ResultStatsProps {
  questions: Question[];
  userAnswers: Record<string, string>;
  studentInfo?: { name: string; class: string } | null;
  allowReview?: boolean;
  onRestart: () => void;
  onReview: () => void;
  onSave?: (metrics: { score: number, correct: number, total: number }) => void; // NEW
}

const ResultStats: React.FC<ResultStatsProps> = ({ 
  questions, 
  userAnswers, 
  studentInfo, 
  allowReview = true, 
  onRestart, 
  onReview,
  onSave
}) => {
  // Calculate stats
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  questions.forEach(q => {
    const answer = userAnswers[q.id];
    if (!answer) {
      skipped++;
    } else if (answer === q.dapAnDung) {
      correct++;
    } else {
      wrong++;
    }
  });

  const total = questions.length;
  const score = total > 0 ? (correct / total) * 10 : 0;
  const correctPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const wrongPercent = total > 0 ? Math.round((wrong / total) * 100) : 0;
  
  // Save results exactly ONCE when mounted, if studentInfo exists
  const hasSavedRef = useRef(false);
  useEffect(() => {
    if (studentInfo && onSave && !hasSavedRef.current) {
        onSave({ score, correct, total });
        hasSavedRef.current = true;
    }
  }, [studentInfo, onSave, score, correct, total]);

  // CSS Conic Gradient for Pie Chart
  const pieStyle = {
    background: `conic-gradient(
      #22c55e 0% ${correctPercent}%, 
      #ef4444 ${correctPercent}% ${correctPercent + wrongPercent}%, 
      #e2e8f0 ${correctPercent + wrongPercent}% 100%
    )`
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-in zoom-in-95 duration-300 p-4">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 sm:p-8 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-1">Kết Quả Bài Làm</h2>
              <div className="text-indigo-100 text-sm">Đã hoàn thành {total} câu hỏi</div>
            </div>

            {studentInfo && (
              <div className="bg-white/10 backdrop-blur-md p-3 rounded-lg border border-white/20 flex items-center gap-4 min-w-[200px]">
                <div className="p-2 bg-white/20 rounded-full">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg leading-tight">{studentInfo.name}</div>
                  <div className="text-xs text-indigo-200 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Lớp: {studentInfo.class}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Summary Section */}
          <div className="flex flex-col md:flex-row items-center justify-around gap-8 mb-10">
            
            {/* Chart */}
            <div className="relative w-48 h-48 flex-shrink-0">
              <div className="w-full h-full rounded-full transition-all duration-1000" style={pieStyle}></div>
              <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="text-4xl font-bold text-slate-800">{score.toFixed(1)}</span>
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Điểm số</span>
              </div>
            </div>

            {/* Stats Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full text-green-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{correct}</div>
                  <div className="text-sm text-green-600">Câu đúng</div>
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full text-red-600">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-700">{wrong}</div>
                  <div className="text-sm text-red-600">Câu sai</div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3 sm:col-span-2">
                <div className="p-2 bg-slate-200 rounded-full text-slate-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-700">{skipped}</div>
                  <div className="text-sm text-slate-500">Chưa trả lời</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center border-t border-slate-100 pt-8">
            {allowReview ? (
              <button
                onClick={onReview}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30"
              >
                <Eye className="w-5 h-5" />
                Xem Lại Bài Thi
              </button>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-400 rounded-xl font-semibold cursor-not-allowed"
                title="Bài thi này không cho phép xem lại"
              >
                <EyeOff className="w-5 h-5" />
                Không cho phép xem lại
              </button>
            )}
            
            <button
              onClick={onRestart}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              Quay Về Trang Chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultStats;
