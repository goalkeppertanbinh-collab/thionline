import React, { useState, useEffect } from 'react';
import { Bot, X, Sparkles, RefreshCw } from 'lucide-react';
import { Question } from '../types';
import { explainQuestion } from '../services/geminiService';
import MathRenderer from './MathRenderer';

interface AITutorProps {
  question: Question;
  userAnswer: string | null; // e.g. 'A' or null
  isOpen: boolean;
  onClose: () => void;
}

const AITutor: React.FC<AITutorProps> = ({ question, userAnswer, isOpen, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !content && !loading) {
      handleExplain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleExplain = async () => {
    setLoading(true);
    const explanation = await explainQuestion(question, userAnswer, question.chuDe);
    setContent(explanation);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px] animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Bot className="w-6 h-6" />
            <h3 className="font-bold text-lg">Gia Sư AI</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
              <p className="text-indigo-600 font-medium animate-pulse">Đang suy nghĩ...</p>
            </div>
          ) : (
            <div className="prose prose-indigo prose-sm w-full max-w-none">
               <div className="whitespace-pre-wrap">
                 <MathRenderer text={content} />
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
          <button
            onClick={handleExplain}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Giải thích lại
          </button>
        </div>
      </div>
    </div>
  );
};

export default AITutor;