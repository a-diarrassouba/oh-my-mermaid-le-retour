// Stroke icons, drawn inline so they follow the text color where asked.

type P = { size?: number; color?: string };
const base = (size: number, color: string) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const Logo = ({ size = 28, color = 'var(--accent)' }: P) => (
  <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
    <path d="M13 3 L23 21 H3 Z" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <path d="M13 3 L13 21" stroke={color} strokeWidth="1.4" />
  </svg>
);
export const MapIcon = ({ size = 30, color = '#352BA6' }: P) => (
  <svg {...base(size, color)}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const Sprout = ({ size = 28, color = '#1F7A4D' }: P) => (
  <svg {...base(size, color)}><path d="M12 21v-9" /><path d="M12 12c0-4 3-7 8-7 0 4-3 7-8 7z" /><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z" /></svg>
);
export const Book = ({ size = 28, color = '#0B4F66' }: P) => (
  <svg {...base(size, color)}><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" /><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" /></svg>
);
export const CodeIcon = ({ size = 28, color = '#352BA6' }: P) => (
  <svg {...base(size, color)}><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /><path d="M13.5 4l-3 16" /></svg>
);
export const Leaf = ({ size = 30, color = '#9A3412' }: P) => (
  <svg {...base(size, color)}><path d="M12 20V10" /><path d="M12 10c0-4 3-6 7-6 0 4-3 6-7 6z" /><path d="M12 13c0-3-2-5-6-5 0 3 2 5 6 5z" /></svg>
);
export const Shield = ({ size = 30, color = '#1F7A4D' }: P) => (
  <svg {...base(size, color)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>
);
export const Arrow = ({ size = 18, color = '#fff' }: P) => (
  <svg {...base(size, color)} strokeWidth={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
