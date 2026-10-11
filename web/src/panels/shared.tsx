import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';

/** Haptic tick. Safe no-op where vibration is unsupported. */
export function buzz(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* vibration unsupported or blocked */
  }
}

/** Compact panel header: label + close button (44px target). */
export function PanelHeader({
  icon: Icon,
  label,
  onDismiss,
}: {
  icon: LucideIcon;
  label: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-amber-500 shrink-0" />
        <h2 className="font-black text-lg tracking-tight">{label}</h2>
      </div>
      {onDismiss && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            buzz();
            onDismiss();
          }}
          aria-label="Close panel"
          className="w-11 h-11 -mr-1 -mt-1 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
        >
          <X size={20} />
        </motion.button>
      )}
    </div>
  );
}

/** Uppercase micro-label used across panels. */
export function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{children}</span>
  );
}

/** Shared mount transition (opacity + 8px rise). */
export function PanelMount({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Card shell: white rounded-2xl on the dark base. */
export function PanelCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 ${className}`}>
      {children}
    </div>
  );
}

/** Centered loading / empty / error block. */
export function PanelState({ children, busy = false }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <div className="py-12 text-center text-sm text-slate-500">
      {busy && <div className="animate-pulse mb-2">Loading…</div>}
      {children}
    </div>
  );
}
