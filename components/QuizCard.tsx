
import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { CheckCircle, XCircle, HelpCircle, BookOpen, Bot, ImageOff, Maximize2, X } from 'lucide-react';
import MathRenderer from './MathRenderer';

interface QuizCardProps {
  question: Question;
  selectedAnswer: string | null;
  isSubmitted: boolean;
  onAnswer: (answer: 'A' | 'B' | 'C' | 'D') => void;
  onAskAI: () => void;
  isExamMode?: boolean;
}

// Helper to convert Google Drive links to High-Res Thumbnail links (Best for Word & Web)
const getDisplayImageUrl = (url?: string) => {
  if (!url || !url.trim()) return undefined;
  
  const cleanUrl = url.trim();

  // Handle Google Drive Links
  if (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com')) {
    // Regex to catch /d/ID/ or id=ID
    const idMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || cleanUrl.match(/id=([a-zA-Z0-9-_]+)/);
    
    if (idMatch && idMatch[1]) {
      // Use sz=s1200 to get high quality for printing (approx A4 width)
      // Standard view links fail in Word because they are HTML pages.
      return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=s1200`;
    }
  }
  return cleanUrl;
};

const QuizCard: React.FC<QuizCardProps> = ({ 
  question, 
  selectedAnswer, 
  isSubmitted, 
  onAnswer, 
  onAskAI,
  isExamMode = false
}) => {
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Reset local state when question changes
  useEffect(() => {
    setShowHint(false);
    setShowSolution(false);
    setImageError(false);
    setIsZoomed(false);
  }, [question?.id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (!question) return null;

  const displayImageUrl = getDisplayImageUrl(question.linkAnh);

  const handleSelect = (option: 'A' | 'B' | 'C' | 'D') => {
    if (isSubmitted) return; // Prevent changing after submit
    onAnswer(option);
  };

  const getOptionStyle = (option: 'A' | 'B' | 'C' | 'D') => {
    const baseStyle = "p-4 rounded-xl border-2 text-left transition-all duration-200 relative overflow-hidden group flex items-start gap-3";
    const isSelected = selectedAnswer === option;
    
    // --- MODE: DOING QUIZ (Not Submitted) ---
    if (!isSubmitted) {
      if (isSelected) {
        return `${baseStyle} border-indigo-500 bg-indigo-50 text-indigo-900 font-medium shadow-sm`;
      }
      return `${baseStyle} border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer text-slate-700`;
    }

    // --- MODE: REVIEW (Submitted) ---
    // 1. Correct Answer (Always Green)
    if (option === question.dapAnDung) {
      return `${baseStyle} border-green-500 bg-green-50 text-green-800`;
    }
    
    // 2. User chose this (Wrong) -> Red
    if (isSelected && option !== question.dapAnDung) {
      return `${baseStyle} border-red-500 bg-red-50 text-red-800`;
    }

    // 3. Other options -> Dimmed
    return `${baseStyle} border-slate-100 opacity-50`;
  };

  return (
    <>
      <div className="w-full max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header info - ONLY SHOW IN REVIEW MODE (NOT EXAM MODE) */}
          {!isExamMode && (
            <div className="px-6 py-4 border-b border-slate-100 flex items-center flex-wrap gap-2 text-sm font-medium text-slate-500">
               <span className="text-slate-700">Lớp {question.lop}</span>
               <span className="text-slate-300">•</span>
               <span>{question.chuDe}</span>
               {question.bai && (
                 <>
                   <span className="text-slate-300">•</span>
                   <span className="text-indigo-600">{question.bai}</span>
                 </>
               )}
            </div>
          )}

          <div className="p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 leading-relaxed mb-6">
              <MathRenderer text={question.cauHoi} />
            </h2>

            {/* ONLY RENDER IF IMAGE URL IS VALID AND NOT ERROR */}
            {displayImageUrl && !imageError && (
              <div className="mb-6 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex justify-center relative min-h-[100px]">
                  <div 
                    className="relative group cursor-zoom-in w-full flex justify-center bg-slate-50"
                    onClick={() => setIsZoomed(true)}
                  >
                    <img 
                      src={displayImageUrl} 
                      alt="Question illustration" 
                      className="max-h-60 object-contain transition-opacity group-hover:opacity-90"
                      onError={() => setImageError(true)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                      <div className="bg-white/90 rounded-full p-2 shadow-sm">
                        <Maximize2 className="w-5 h-5 text-slate-700" />
                      </div>
                    </div>
                  </div>
              </div>
            )}

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={getOptionStyle(opt)}
                  disabled={isSubmitted}
                >
                  <span className={`font-bold mt-0.5 ${selectedAnswer === opt || (isSubmitted && opt === question.dapAnDung) ? '' : 'text-slate-400'}`}>
                    {opt}.
                  </span>
                  <div className="flex-1">
                    <MathRenderer text={question[`dapAn${opt}`]} />
                  </div>
                  
                  {isSubmitted && opt === question.dapAnDung && (
                    <CheckCircle className="absolute top-4 right-4 w-5 h-5 text-green-500" />
                  )}
                  {isSubmitted && selectedAnswer === opt && opt !== question.dapAnDung && (
                    <XCircle className="absolute top-4 right-4 w-5 h-5 text-red-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Action Bar - HIDE IN EXAM MODE */}
          {isSubmitted && !isExamMode && (
            <div className="bg-slate-50 border-t border-slate-200 p-4 sm:px-8 flex flex-wrap items-center gap-3 animate-in fade-in duration-300">
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                {showHint ? 'Ẩn Gợi Ý' : 'Xem Gợi Ý'}
              </button>
              
              <button
                onClick={() => setShowSolution(!showSolution)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                {showSolution ? 'Ẩn Lời Giải' : 'Lời Giải Chi Tiết'}
              </button>

              <div className="flex-1" />

              <button
                onClick={onAskAI}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                <Bot className="w-4 h-4" />
                Hỏi Gia Sư AI
              </button>
            </div>
          )}
        </div>

        {/* Hints & Solutions Expansion - HIDE IN EXAM MODE */}
        {isSubmitted && !isExamMode && (showHint || showSolution) && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            {showHint && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" /> Gợi ý
                </h4>
                <div className="text-amber-900">
                  <MathRenderer text={question.goiY || "Không có gợi ý cho câu hỏi này."} />
                </div>
              </div>
            )}
            
            {showSolution && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
                <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Lời giải chi tiết
                </h4>
                <div className="text-indigo-900 whitespace-pre-wrap">
                  <MathRenderer text={question.loiGiai || "Chưa cập nhật lời giải."} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {isZoomed && displayImageUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10"
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={displayImageUrl} 
            alt="Zoomed question" 
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
};

export default QuizCard;
