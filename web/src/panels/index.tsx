import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { Target, Users, Wallet, Dumbbell, Briefcase, LifeBuoy } from 'lucide-react';
import PathPanel from './PathPanel';
import CirclePanel from './CirclePanel';
import MoneyPanel from './MoneyPanel';
import MovePanel from './MovePanel';
import WorkPanel from './WorkPanel';
import CoachPanel from './CoachPanel';

export type PanelId = 'path' | 'circle' | 'money' | 'move' | 'work' | 'coach';

export interface PanelProps {
  onDismiss?: () => void;
}

export const PANEL_REGISTRY: Record<
  PanelId,
  { label: string; icon: LucideIcon; component: ComponentType<PanelProps> }
> = {
  path: { label: 'My Path', icon: Target, component: PathPanel },
  circle: { label: 'Circle', icon: Users, component: CirclePanel },
  money: { label: 'Money', icon: Wallet, component: MoneyPanel },
  move: { label: 'Move', icon: Dumbbell, component: MovePanel },
  work: { label: 'Work', icon: Briefcase, component: WorkPanel },
  coach: { label: 'Coach', icon: LifeBuoy, component: CoachPanel },
};

// Shared panel UI lives in ./shared and is re-exported here so consumers can
// import everything panel-related from this barrel.
export { buzz, PanelHeader, MicroLabel, PanelMount, PanelCard, PanelState } from './shared';
