// src/components/BrandedSplash.jsx
// ⚡ Web port of the RN splash — all Animated loops are CSS keyframes.
// Only the typewriter, the 10s master timer and skip logic stay in JS.
import React, { useEffect, useRef, useState } from 'react';
import LOGO from '../../src/assets/logo.png'; // adjust path (Vite/CRA both support this)

// ==================== TIMING (all in ms) ====================
const COMPANY_NAME = 'BimTech Solution Innitiative';
const SPLASH_DURATION = 10000; // ⏱️ TOTAL visible time — tune everything here
const TYPE_DELAY = 700;
const TYPE_SPEED = 115;
const FADE_OUT = 800;
const PARTICLE_POSITIONS = ['8%', '20%', '33%', '47%', '60%', '73%', '86%', '94%'];

export default function BrandedSplash({ onFinish }) {
  const [typedText, setTypedText] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [fadeMs, setFadeMs] = useState(FADE_OUT);
  const endedRef = useRef(false);
  const timers = useRef({
    typeTimeout: null, typeInterval: null, masterTimeout: null, fadeTimeout: null,
  });

  const finish = (duration = FADE_OUT) => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearTimeout(timers.current.typeTimeout);
    clearInterval(timers.current.typeInterval);
    clearTimeout(timers.current.masterTimeout);
    setFadeMs(duration);
    setLeaving(true);
    timers.current.fadeTimeout = setTimeout(() => onFinish?.(), duration);
  };

  useEffect(() => {
    // ⏱️ MASTER TIMER — guarantees the full 10 seconds
    timers.current.masterTimeout = setTimeout(() => finish(), SPLASH_DURATION);

    // ---------- TYPEWRITER — starts at 0.7s, finishes ~3.9s ----------
    timers.current.typeTimeout = setTimeout(() => {
      let i = 0;
      timers.current.typeInterval = setInterval(() => {
        i += 1;
        setTypedText(COMPANY_NAME.slice(0, i));
        if (i >= COMPANY_NAME.length) clearInterval(timers.current.typeInterval);
      }, TYPE_SPEED);
    }, TYPE_DELAY);

    return () => {
      clearTimeout(timers.current.typeTimeout);
      clearTimeout(timers.current.masterTimeout);
      clearInterval(timers.current.typeInterval);
      clearTimeout(timers.current.fadeTimeout);
    };
  }, []);

  return (
    <div
      className={`bs-overlay${leaving ? ' bs-leaving' : ''}`}
      style={leaving ? { transitionDuration: `${fadeMs}ms` } : undefined}
      onClick={() => finish(350)} /* click anywhere to skip */
    >
      {/* Floating rising particles (negative delays → already mid-flight at frame 1) */}
      {PARTICLE_POSITIONS.map((left, i) => (
        <span
          key={`p-${i}`}
          className="bs-particle"
          style={{
            left,
            width: 3 + (i % 3) * 1.5,
            height: 3 + (i % 3) * 1.5,
            animationDuration: `${6500 + (i % 3) * 2000}ms`,
            animationDelay: `-${(i * 650) % 5000}ms`,
          }}
        />
      ))}

      <div className="bs-content">
        {/* 🎯 Logo stage — fixed 260×260 box, rings centered on the logo */}
        <div className="bs-logoStage">
          <span className="bs-ring" />
          <span className="bs-ring2" />

          {/* Spring-in on the badge, breathing on an inner wrapper —
              web transforms don't multiply like RN's, so we nest them */}
          <div className="bs-logoBadge">
            <div className="bs-logoBreath">
              <img src={LOGO} alt="logo" className="bs-logo" />
            </div>
          </div>
        </div>

        <p className="bs-poweredBy">POWERED BY</p>

        <div className="bs-companyRow">
          <span className="bs-companyName">{typedText}</span>
          <span className="bs-cursor" />
        </div>

        <div className="bs-dotsRow">
          {[0, 1, 2].map((i) => (
            <span key={`d-${i}`} className="bs-dot" style={{ animationDelay: `${i * 140}ms` }} />
          ))}
        </div>

        <div className="bs-progressTrack">
          <span className="bs-progressFill" />
        </div>

        <p className="bs-hint">Click anywhere to skip</p>
      </div>

      <style>{css}</style>
    </div>
  );
}

// ==================== STYLES (mirrors the RN StyleSheet 1:1) ====================
const css = `
.bs-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #030303;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; user-select: none; overflow: hidden;
}
.bs-overlay.bs-leaving {
  opacity: 0;
  transition-property: opacity;
  transition-timing-function: ease;
  pointer-events: none;
}

/* Content appears instantly — 250ms soft fade, no dead black time */
.bs-content { display: flex; flex-direction: column; align-items: center; animation: bs-fadeIn 250ms linear both; }
@keyframes bs-fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ---------- Logo stage ---------- */
.bs-logoStage { position: relative; width: 260px; height: 260px; }
.bs-ring {
  position: absolute; width: 190px; height: 190px; top: 35px; left: 35px;
  border: 1.5px solid rgba(0,212,170,0.5); border-radius: 50%;
  animation: bs-ringPulse 3200ms ease-in-out infinite;
}
@keyframes bs-ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.45; }
  50% { transform: scale(1.18); opacity: 0.08; }
}
.bs-ring2 {
  position: absolute; width: 250px; height: 250px; top: 5px; left: 5px;
  border: 1px solid rgba(0,212,170,0.35); border-radius: 50%;
  animation: bs-ringPulse2 4000ms ease-in-out infinite;
}
@keyframes bs-ringPulse2 {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.35); opacity: 0.05; }
}

/* Spring-in (overshoot bezier ≈ RN spring, friction 5 / tension 45) */
.bs-logoBadge {
  position: absolute; top: 76px; left: 76px; width: 108px; height: 108px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,212,170,0.12);
  border: 1.5px solid #00d4aa; border-radius: 32px;
  box-shadow: 0 0 25px rgba(0,212,170,0.7);
  animation: bs-logoIn 900ms cubic-bezier(0.175, 0.885, 0.32, 1.35) both;
}
@keyframes bs-logoIn {
  0% { transform: scale(0.2); opacity: 0; }
  60% { opacity: 1; }
  70% { transform: scale(1.07); }
  100% { transform: scale(1); opacity: 1; }
}
/* Logo "breathing" — takes over once the spring settles */
.bs-logoBreath { display: flex; animation: bs-breathe 3600ms ease-in-out infinite; }
@keyframes bs-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
.bs-logo { width: 62px; height: 62px; object-fit: contain; }

.bs-poweredBy {
  color: #8a8f98; font-size: 12px; font-weight: 700; letter-spacing: 4px;
  text-transform: uppercase; margin: 12px 0 0;
  animation: bs-fadeIn2 350ms linear both;
}
@keyframes bs-fadeIn2 { from { opacity: 0; } to { opacity: 1; } }

.bs-companyRow { display: flex; align-items: center; margin-top: 10px; min-height: 32px; }
.bs-companyName {
  color: #fff; font-size: 21px; font-weight: 800; letter-spacing: 0.4px;
  text-shadow: 0 0 14px rgba(0,212,170,0.85); white-space: nowrap;
}
.bs-cursor { width: 2px; height: 24px; background: #00d4aa; margin-left: 4px; animation: bs-blink 800ms linear infinite; }
@keyframes bs-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.bs-dotsRow { display: flex; margin-top: 22px; }
.bs-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #00d4aa; margin: 0 5px;
  animation: bs-bounce 640ms ease-in-out infinite;
}
@keyframes bs-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

/* Progress bar — fills across the FULL duration */
.bs-progressTrack {
  width: 180px; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,0.08); margin-top: 26px; overflow: hidden;
}
.bs-progressFill {
  display: block; height: 3px; border-radius: 2px; background: #00d4aa;
  animation: bs-fill ${SPLASH_DURATION}ms ease-in-out forwards;
}
@keyframes bs-fill { from { width: 0; } to { width: 100%; } }

.bs-hint {
  color: #4a4f55; font-size: 11px; letter-spacing: 1px; margin: 18px 0 0;
  animation: bs-hintPulse 3200ms ease-in-out infinite;
}
@keyframes bs-hintPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }

/* Rising particles — duration & delay are set inline per particle */
.bs-particle {
  position: absolute; bottom: -30px; border-radius: 50%; background: #00d4aa;
  animation-name: bs-rise; animation-timing-function: linear; animation-iteration-count: infinite;
}
@keyframes bs-rise {
  0% { transform: translateY(0); opacity: 0; }
  12% { opacity: 0.55; }
  85% { opacity: 0.25; }
  100% { transform: translateY(calc(-100vh - 110px)); opacity: 0; }
}
`;