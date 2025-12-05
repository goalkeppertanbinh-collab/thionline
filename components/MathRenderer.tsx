import React from 'react';

// Khai báo global katex vì được load qua thẻ script
declare global {
  interface Window {
    katex: any;
  }
}

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

const MathRenderer: React.FC<MathRendererProps> = ({ text, className = '', inline = true }) => {
  if (!text) return null;

  // Tách chuỗi dựa trên dấu $...$
  // Regex này tìm các đoạn nằm giữa 2 dấu $
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const math = part.slice(1, -1);
          try {
            if (window.katex) {
              const html = window.katex.renderToString(math, {
                throwOnError: false,
                displayMode: false, // Inline mode
                output: 'html', // Render ra HTML để nhẹ hơn
              });
              return (
                <span 
                  key={index} 
                  dangerouslySetInnerHTML={{ __html: html }} 
                  className="mx-0.5"
                />
              );
            }
            // Fallback nếu chưa load xong thư viện
            return <span key={index} className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">{math}</span>;
          } catch (e) {
            console.error("Lỗi render math:", e);
            return <span key={index}>{part}</span>;
          }
        }
        // Trả về text thường
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default MathRenderer;