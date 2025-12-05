import React from 'react';
import { FilterState, Question } from '../types';
import { Filter } from 'lucide-react';

interface FilterBarProps {
  questions: Question[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ questions, filters, onFilterChange }) => {
  // Extract unique values
  const classes = Array.from(new Set(questions.map(q => q.lop).filter(Boolean))).sort();
  const topics = Array.from(new Set(questions.map(q => q.chuDe).filter(Boolean))).sort();
  const lessons = Array.from(new Set(
    questions
      .filter(q => (!filters.chuDe || q.chuDe === filters.chuDe))
      .map(q => q.bai)
      .filter(Boolean)
  )).sort();

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    // Reset child filters if parent changes
    if (key === 'chuDe') newFilters.bai = '';
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 shadow-sm">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
        <div className="flex items-center text-slate-400 mr-2">
          <Filter className="w-4 h-4" />
        </div>
        
        <select
          value={filters.lop}
          onChange={(e) => handleChange('lop', e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none"
        >
          <option value="">Tất cả Lớp</option>
          {classes.map(c => <option key={c} value={c}>Lớp {c}</option>)}
        </select>

        <select
          value={filters.chuDe}
          onChange={(e) => handleChange('chuDe', e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none min-w-[150px]"
        >
          <option value="">Tất cả Chủ đề</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.bai}
          onChange={(e) => handleChange('bai', e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none min-w-[150px]"
          disabled={!filters.chuDe}
        >
          <option value="">Tất cả Bài</option>
          {lessons.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        
        <div className="ml-auto text-sm text-slate-500 hidden sm:block">
          {questions.length} câu hỏi
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
