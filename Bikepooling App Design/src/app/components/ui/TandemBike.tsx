import React from "react";

interface TandemBikeProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function TandemBike({ className = "w-full h-full", ...props }: TandemBikeProps) {
  const gradId = "g-dual-orbit";
  return (
    <svg
      viewBox="0 0 56 56"
      className={className}
      fill="none"
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="56" y2="56">
          <stop offset="0%" stopColor="#2E5BFF"/>
          <stop offset="100%" stopColor="#FFB020"/>
        </linearGradient>
      </defs>
      <g transform="rotate(-12 28 28)">
        <circle cx="20" cy="30" r="13" fill="none" stroke={`url(#${gradId})`} strokeWidth="3.4"/>
        <circle cx="20" cy="30" r="2" fill="#FFB020"/>
        <line x1="20" y1="30" x2="20" y2="19" stroke="#2E5BFF" strokeWidth="1.6" opacity="0.7"/>
        <line x1="20" y1="30" x2="29.5" y2="24.5" stroke="#2E5BFF" strokeWidth="1.6" opacity="0.7"/>
        <line x1="20" y1="30" x2="29.5" y2="35.5" stroke="#2E5BFF" strokeWidth="1.6" opacity="0.7"/>
        <line x1="20" y1="30" x2="14" y2="20" stroke="#2E5BFF" strokeWidth="1.6" opacity="0.5"/>
        <line x1="20" y1="30" x2="11" y2="33" stroke="#2E5BFF" strokeWidth="1.6" opacity="0.5"/>
        <circle cx="35" cy="27" r="9.5" fill="#FFB020"/>
        <circle cx="35" cy="27" r="4.2" fill="#14122B"/>
        <path d="M 4 36 L 14 33" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" opacity="0.55"/>
        <path d="M 1 41 L 11 37.5" stroke={`url(#${gradId})`} strokeWidth="2.4" strokeLinecap="round" opacity="0.3"/>
      </g>
    </svg>
  );
}
