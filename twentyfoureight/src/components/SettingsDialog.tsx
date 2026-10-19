import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Settings, ThemePreference } from '../game/storage';
import { hapticsSupported } from '../lib/haptics';
import { Modal } from './Modal';

interface SwitchRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

function SwitchRow({ label, hint, checked, disabled = false, onChange }: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl px-3 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-cell'}`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

const THEMES: Array<{ value: ThemePreference; label: string; icon: ReactNode }> = [
  { value: 'system', label: 'Auto', icon: <Monitor size={16} aria-hidden="true" /> },
  { value: 'light', label: 'Light', icon: <Sun size={16} aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={16} aria-hidden="true" /> },
];

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  best: number;
  onChange: (patch: Partial<Settings>) => void;
  onResetBest: () => void;
  onClose: () => void;
}

export function SettingsDialog({ open, settings, best, onChange, onResetBest, onClose }: SettingsDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="-mx-3 flex flex-col">
        <SwitchRow label="Sound" hint="Soft synthesized effects" checked={settings.sound} onChange={(v) => onChange({ sound: v })} />
        <SwitchRow
          label="Vibration"
          hint={hapticsSupported ? 'Subtle haptic feedback' : 'Not supported on this device'}
          checked={settings.haptics && hapticsSupported}
          disabled={!hapticsSupported}
          onChange={(v) => onChange({ haptics: v })}
        />
        <SwitchRow
          label="Animations"
          hint="Sliding, merging and celebrations"
          checked={settings.animations}
          onChange={(v) => onChange({ animations: v })}
        />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-semibold text-muted">Theme</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => {
            const active = settings.theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ theme: t.value })}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-surface text-text shadow-sm ring-1 ring-line' : 'text-muted hover:text-text'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <div className="text-sm">
          <div className="font-semibold">Best score</div>
          <div className="text-muted tabular-nums">{best.toLocaleString('en-US')}</div>
        </div>
        <button type="button" className="btn btn-danger-outline" onClick={onResetBest} disabled={best === 0}>
          Reset best
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-muted">
        Keys: arrows or WASD to move · U or Ctrl+Z to undo
        <br />
        Inspired by 2048 by Gabriele Cirulli.
      </p>
    </Modal>
  );
}
