import { cn } from '@/lib/utils';
import './AiMascot.css';

/**
 * The HRISense AI assistant's character: a violet speech bubble with a face
 * screen, a sparkle tuft, a woven lanyard with an HR ID badge and (in the full
 * pose) an insight card. Drawn in SVG and animated with CSS only — see
 * AiMascot.css. All motion stops under `prefers-reduced-motion`.
 *
 * Its colours are fixed artwork colours (violet = the AI accent, teal = the
 * Hospicio brand) and read on both light and dark surfaces.
 */

export type AiMascotState = 'idle' | 'thinking' | 'done' | 'hello';

export interface AiMascotProps {
  /** idle = floats, blinks, waves · thinking = an answer is being prepared · done = an answer just arrived · hello = waves without pause. */
  state?: AiMascotState;
  /** The mouth opens and closes as if speaking (idle and hello faces). */
  talking?: boolean;
  /** `full` adds the arms, lanyard and insight card; `compact` is the bubble and face for avatars and buttons. */
  variant?: 'full' | 'compact';
  /** Rendered height in px; the width follows the artwork. */
  size?: number;
  /** false keeps it still (state changes still show). */
  animated?: boolean;
  /** Announced to screen readers when given; otherwise the mascot is decorative. */
  label?: string;
  className?: string;
}

const BODY =
  'M180 70 C232 70 258 104 258 152 C258 204 228 240 196 252 C188 266 172 286 146 298 C156 282 160 266 158 254 C124 242 102 206 102 152 C102 104 128 70 180 70Z';
const HEART =
  'M180 229 C173 224 170 220 173 216 C175 213 178 214 180 217 C182 214 185 213 187 216 C190 220 187 224 180 229Z';
const LANYARD = 'M144 182 L180 212 L216 182';

/** A four-point sparkle centred on (cx, cy). */
function sparkle(cx: number, cy: number, r: number) {
  const k = +(r * 0.19).toFixed(1);
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

const VIEWBOX = { full: { x: 40, y: 26, w: 300, h: 304 }, compact: { x: 98, y: 28, w: 164, h: 274 } };

export function AiMascot({ state = 'idle', talking = false, variant = 'compact', size = 40, animated = true, label, className }: AiMascotProps) {
  const full = variant === 'full';
  const vb = VIEWBOX[variant];
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      height={size}
      width={Math.round((size * vb.w) / vb.h)}
      className={cn('ai-mascot', `ai-mascot--${state}`, talking && 'ai-mascot--talking', !animated && 'ai-mascot--still', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}
    >
      {full && <ellipse className="m-shadow" cx="170" cy="320" rx="46" ry="7" fill="#7c3aed" opacity="0.18" />}
      <g className="m-float">
        {full && (
          <>
            <path className="m-wave-line" d="M62 124 Q57 136 62 148" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path className="m-wave-line" d="M52 118 Q45 136 52 154" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round" />
            <g className="m-arm">
              <path d="M116 178 Q86 170 80 140" stroke="#7c3aed" strokeWidth="13" fill="none" strokeLinecap="round" />
              <circle cx="80" cy="136" r="10" fill="#7c3aed" />
            </g>
            <path d="M246 180 Q272 182 278 200" stroke="#7c3aed" strokeWidth="13" fill="none" strokeLinecap="round" />
          </>
        )}

        <path d={BODY} fill="#7c3aed" />
        <path d="M124 108 Q130 86 154 80" stroke="#a78bfa" strokeWidth="6" fill="none" strokeLinecap="round" />
        <rect x="124" y="104" width="112" height="76" rx="32" fill="#2e1065" />

        {/* Faces — the state class decides which one shows. */}
        <g className="m-face m-face-idle">
          <g className="m-blink">
            <ellipse cx="156" cy="138" rx="9" ry="12" fill="#99f6e4" />
            <ellipse cx="204" cy="138" rx="9" ry="12" fill="#99f6e4" />
            <circle cx="159" cy="133" r="3" fill="#ffffff" />
            <circle cx="207" cy="133" r="3" fill="#ffffff" />
          </g>
          <path className="m-smile" d="M164 158 Q180 170 196 158" stroke="#99f6e4" strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse className="m-mouth-open" cx="180" cy="162" rx="9" ry="7" fill="#99f6e4" />
        </g>
        <g className="m-face m-face-thinking">
          <g className="m-blink">
            <ellipse cx="166" cy="130" rx="8" ry="10" fill="#99f6e4" />
            <ellipse cx="212" cy="130" rx="8" ry="10" fill="#99f6e4" />
            <circle cx="168" cy="126" r="2.5" fill="#ffffff" />
            <circle cx="214" cy="126" r="2.5" fill="#ffffff" />
          </g>
          <path d="M168 162 Q174 157 180 162 Q186 167 192 162" stroke="#99f6e4" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
        <g className="m-face m-face-done">
          <path d="M146 142 Q156 128 166 142" stroke="#99f6e4" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M194 142 Q204 128 214 142" stroke="#99f6e4" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M162 154 Q180 176 198 154Z" fill="#99f6e4" />
        </g>
        <ellipse cx="137" cy="160" rx="6" ry="3.5" fill="#f9a8d4" />
        <ellipse cx="223" cy="160" rx="6" ry="3.5" fill="#f9a8d4" />

        <path className="m-sparkle" d={sparkle(180, 50, 18)} fill="#fbbf24" />
        <path className="m-sparkle m-sparkle-2" d={sparkle(209, 58, 9)} fill="#fbbf24" />
        <path className="m-sparkle m-sparkle-3" d={sparkle(153, 62, 6)} fill="#fde68a" />

        {/* Woven lanyard (a nod to banig) and the HR ID badge. */}
        <path d={LANYARD} stroke="#148281" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={LANYARD} stroke="#97d6d4" strokeWidth="6" fill="none" strokeDasharray="4 6" strokeLinejoin="round" />
        <rect x="165" y="206" width="30" height="38" rx="5" fill="#ffffff" />
        <rect x="173" y="202" width="14" height="7" rx="2" fill="#0d6362" />
        <path d={HEART} fill="#148281" />
        <line x1="172" y1="237" x2="188" y2="237" stroke="#97d6d4" strokeWidth="2.5" strokeLinecap="round" />

        {full && (
          <>
            <rect x="274" y="166" width="50" height="42" rx="7" fill="#ffffff" stroke="#c4b5fd" strokeWidth="2" />
            <rect className="m-bar" x="290" y="188" width="7" height="12" rx="1.5" fill="#4db8b6" />
            <rect className="m-bar m-bar-2" x="301" y="180" width="7" height="20" rx="1.5" fill="#148281" />
            <rect className="m-bar m-bar-3" x="312" y="174" width="7" height="26" rx="1.5" fill="#0d6362" />
            <path className="m-sparkle m-sparkle-2" d={sparkle(326, 156, 6)} fill="#fbbf24" />
            <g className="m-check">
              <circle cx="322" cy="166" r="9" fill="#148281" />
              <path d="M317.5 166 L321 169.5 L326.5 162.5" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <circle cx="276" cy="204" r="10" fill="#7c3aed" />
            <g className="m-dots">
              <circle className="m-dot" cx="248" cy="88" r="4" fill="#c4b5fd" />
              <circle className="m-dot m-dot-2" cx="260" cy="76" r="5" fill="#c4b5fd" />
              <circle className="m-dot m-dot-3" cx="274" cy="63" r="6" fill="#c4b5fd" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
