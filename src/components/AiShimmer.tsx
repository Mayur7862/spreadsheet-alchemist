// src/components/AiShimmer.tsx
'use client';
import React from 'react';

export default function AiShimmer() {
  return (
    <div style={{ position: 'relative', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999 }}>
      <div className="ai-shimmer-bar" />
      <style jsx>{`
        .ai-shimmer-bar {
          position: absolute;
          top: 0; left: 0;
          height: 100%;
          width: 30%;
          background: linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,0.45), rgba(59,130,246,0.15));
          border-radius: 999px;
          animation: ai-shimmer 1.2s infinite ease-in-out;
          box-shadow: 0 0 16px rgba(59,130,246,0.4);
        }
        @keyframes ai-shimmer {
          0% { transform: translateX(-10%); }
          50% { transform: translateX(80%); }
          100% { transform: translateX(210%); }
        }
      `}</style>
    </div>
  );
}
