// DevChat brand mark — a navy chat bubble with a lime ">_" terminal prompt.
const Logo = ({ className = "size-9" }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="DevChat"
  >
    <defs>
      <linearGradient id="dcLogoGrad" x1="6" y1="4" x2="42" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2452A8" />
        <stop offset="1" stopColor="#10367D" />
      </linearGradient>
    </defs>
    {/* bubble tail (drawn first so the bubble overlaps its top edge) */}
    <path d="M15 33 L15 45 L26 35 Z" fill="#10367D" />
    {/* bubble */}
    <rect x="4" y="5" width="40" height="32" rx="10" fill="url(#dcLogoGrad)" />
    {/* ">" chevron */}
    <path d="M16.5 16 L22.5 21 L16.5 26" stroke="#A5CE00" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    {/* "_" cursor */}
    <path d="M25.5 26 H32.5" stroke="#A5CE00" strokeWidth="3.2" strokeLinecap="round" />
  </svg>
);

export default Logo;
