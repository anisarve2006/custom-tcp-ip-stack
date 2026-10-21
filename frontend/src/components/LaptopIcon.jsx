import React from 'react';

export default function LaptopIcon({ variant = 'sender', width = 78, height = 64 }) {
  const isSender = variant === 'sender';
  const strokeColor = isSender ? '#7C3AED' : '#0D9488';
  const gradStart = isSender ? '#8B5CF6' : '#14B8A6';
  const gradEnd = isSender ? '#6D28D9' : '#0F766E';
  const lightLine = isSender ? '#EDE9FE' : '#CCFBF1';
  const gradId = isSender ? 'laptop-grad-sender' : 'laptop-grad-receiver';

  return (
    <svg width={width} height={height} viewBox="0 0 64 50" fill="none" style={{ filter: isSender ? 'drop-shadow(0 6px 16px rgba(124, 58, 237, 0.28))' : 'drop-shadow(0 6px 16px rgba(13, 148, 136, 0.25))' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={gradStart} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
      </defs>
      {/* Screen Frame */}
      <rect x="7" y="3" width="50" height="34" rx="4" fill="#0F172A" stroke={strokeColor} strokeWidth="2" />
      {/* Glossy Screen Glass */}
      <rect x="11" y="7" width="42" height="26" rx="2" fill={`url(#${gradId})`} />
      {/* Data Lines on Screen */}
      <path d="M22 16H42M22 20H36M22 24H30" stroke={lightLine} strokeWidth="2" strokeLinecap="round" opacity="0.95" />
      {/* Laptop Base */}
      <path d="M2 40C2 37.5 4 35.5 6.5 35.5H57.5C60 35.5 62 37.5 62 40V44.5C62 45.3 61.3 46 60.5 46H3.5C2.7 46 2 45.3 2 44.5V40Z" fill="#1E293B" stroke="#334155" strokeWidth="1" />
      {/* Trackpad notch */}
      <rect x="25" y="37" width="14" height="2.5" rx="1.25" fill="#64748B" />
    </svg>
  );
}
