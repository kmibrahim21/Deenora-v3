import React from 'react';
import mascotLogo from '../../assets/images/deenora_ai_logo_1791022053953.jpg';

interface AnimatedTypingMascotProps {
  size?: number;
  isDark?: boolean;
  className?: string;
}

export const AnimatedTypingMascot: React.FC<AnimatedTypingMascotProps> = ({
  size = 150,
  isDark = true,
  className = ''
}) => {
  return (
    <div 
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size * 1.3, height: size * 1.25 }}
    >
      {/* Background Radial Glow */}
      <div 
        className="absolute inset-0 rounded-full opacity-60 blur-2xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, rgba(99, 102, 241, 0.2) 50%, transparent 80%)'
        }}
      />

      {/* ========================================================
          1. 3D MASCOT AVATAR WITH ORBITING CYBER RINGS
          ======================================================== */}
      <div className="relative flex items-center justify-center mascot-float-container">
        
        {/* Orbit Ring 1 (Clockwise) */}
        <div 
          className="absolute rounded-full border border-dashed border-cyan-400/60 pointer-events-none"
          style={{
            width: size * 1.05,
            height: size * 0.55,
            transform: 'rotate(-15deg)',
            animation: 'orbitSpin1 12s linear infinite'
          }}
        />

        {/* Orbit Ring 2 (Counter-Clockwise) */}
        <div 
          className="absolute rounded-full border border-indigo-400/50 pointer-events-none"
          style={{
            width: size * 0.95,
            height: size * 0.45,
            transform: 'rotate(25deg)',
            animation: 'orbitSpin2 16s linear infinite'
          }}
        />

        {/* Floating Particle Sparks */}
        <div className="absolute -top-3 right-2 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
        <div className="absolute top-8 -left-3 w-2 h-2 rounded-full bg-[#A3E635] animate-pulse" />
        <div className="absolute -bottom-1 -right-2 w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />

        {/* The Exact 3D Mascot Image Avatar */}
        <div 
          className="relative rounded-full overflow-hidden border-2 border-cyan-400/50 shadow-2xl z-10"
          style={{
            width: size * 0.78,
            height: size * 0.78,
            boxShadow: isDark 
              ? '0 0 25px rgba(56, 189, 248, 0.4), inset 0 0 15px rgba(56, 189, 248, 0.2)' 
              : '0 10px 25px rgba(30, 58, 138, 0.2), 0 0 20px rgba(56, 189, 248, 0.3)'
          }}
        >
          <img 
            src={mascotLogo} 
            alt="Deenora AI Mascot" 
            className="w-full h-full object-cover mascot-img-sway"
          />
          {/* Subtle Cyber Light Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/10 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* ========================================================
          2. SLEEK LAPTOP WITH LIVE ANIMATED TYPING & SCREEN
          ======================================================== */}
      <div 
        className="relative -mt-6 z-20 flex flex-col items-center"
        style={{ width: size * 0.95 }}
      >
        <svg
          viewBox="0 0 180 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full overflow-visible"
        >
          <defs>
            <linearGradient id="laptopBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="screenCodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <filter id="screenGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Screen Back / Open Display */}
          <polygon 
            points="45,15 135,15 142,50 38,50" 
            fill="#0F172A" 
            stroke="#475569" 
            strokeWidth="1.5" 
          />

          {/* Screen Display with Cyan Glow */}
          <polygon 
            points="48,18 132,18 138,48 42,48" 
            fill="url(#screenCodeGrad)" 
            opacity="0.9"
          />

          {/* Animated Code Lines on Screen */}
          <line x1="53" y1="24" x2="85" y2="24" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" className="code-line" />
          <line x1="53" y1="30" x2="115" y2="30" stroke="#A3E635" strokeWidth="2" strokeLinecap="round" className="code-line-fast" />
          <line x1="53" y1="36" x2="95" y2="36" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" className="code-line" />
          <line x1="53" y1="42" x2="122" y2="42" stroke="#FDE047" strokeWidth="1.8" strokeLinecap="round" className="code-line-fast" />

          {/* Glowing Apple/Deenora Star Logo on Laptop Lid Back */}
          <circle cx="90" cy="33" r="3" fill="#FFFFFF" opacity="0.8" filter="url(#screenGlow)" />

          {/* Screen Glow Casting on Keyboard */}
          <polygon 
            points="38,50 142,50 156,66 24,66" 
            fill="url(#laptopBodyGrad)" 
            stroke="#64748B" 
            strokeWidth="1.2" 
          />

          {/* Keyboard Keys Glow Stripe */}
          <polygon 
            points="44,52 136,52 148,63 32,63" 
            fill="#0F172A" 
          />
          <line x1="46" y1="55" x2="134" y2="55" stroke="#38BDF8" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
          <line x1="40" y1="59" x2="140" y2="59" stroke="#818CF8" strokeWidth="1" strokeDasharray="4 2" opacity="0.8" />

          {/* Trackpad */}
          <rect x="76" y="61" width="28" height="4" rx="1" fill="#1E293B" stroke="#475569" strokeWidth="0.5" />

          {/* ========================================================
              ANIMATED FLUFFY TYPING PAWS
              ======================================================== */}
          {/* Left Paw Typing */}
          <g className="paw-left-type">
            <ellipse 
              cx="64" 
              cy="52" 
              rx="9" 
              ry="7" 
              fill="#FFFFFF" 
              filter="drop-shadow(0 3px 5px rgba(0,0,0,0.3))" 
            />
            <circle cx="61" cy="50" r="1.2" fill="#CBD5E1" />
            <circle cx="64" cy="49" r="1.2" fill="#CBD5E1" />
            <circle cx="67" cy="50" r="1.2" fill="#CBD5E1" />
          </g>

          {/* Right Paw Typing */}
          <g className="paw-right-type">
            <ellipse 
              cx="116" 
              cy="52" 
              rx="9" 
              ry="7" 
              fill="#FFFFFF" 
              filter="drop-shadow(0 3px 5px rgba(0,0,0,0.3))" 
            />
            <circle cx="113" cy="50" r="1.2" fill="#CBD5E1" />
            <circle cx="116" cy="49" r="1.2" fill="#CBD5E1" />
            <circle cx="119" cy="50" r="1.2" fill="#CBD5E1" />
          </g>
        </svg>
      </div>

      {/* Embedded High-Performance Animations */}
      <style>{`
        .mascot-float-container {
          animation: mascotFloat 3s ease-in-out infinite;
        }
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }

        .mascot-img-sway {
          animation: mascotSway 4s ease-in-out infinite;
        }
        @keyframes mascotSway {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(2deg) scale(1.02); }
        }

        @keyframes orbitSpin1 {
          0% { transform: rotate(-15deg) rotate(0deg); }
          100% { transform: rotate(-15deg) rotate(360deg); }
        }
        @keyframes orbitSpin2 {
          0% { transform: rotate(25deg) rotate(0deg); }
          100% { transform: rotate(25deg) rotate(-360deg); }
        }

        .paw-left-type {
          animation: pawTypeLeft 0.28s ease-in-out infinite alternate;
          transform-origin: 64px 52px;
        }
        .paw-right-type {
          animation: pawTypeRight 0.28s ease-in-out infinite alternate 0.14s;
          transform-origin: 116px 52px;
        }
        @keyframes pawTypeLeft {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-4px) rotate(-3deg); }
        }
        @keyframes pawTypeRight {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-4px) rotate(3deg); }
        }

        .code-line {
          animation: codeScroll 1.5s infinite ease-in-out;
        }
        .code-line-fast {
          animation: codeScroll 1s infinite ease-in-out 0.2s;
        }
        @keyframes codeScroll {
          0%, 100% { opacity: 0.9; stroke-dasharray: 40; stroke-dashoffset: 0; }
          50% { opacity: 0.4; stroke-dasharray: 40; stroke-dashoffset: 12; }
        }
      `}</style>
    </div>
  );
};

export default AnimatedTypingMascot;
