import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type KeyValueStore, type Settings } from '../game/storage';
import { sound } from '../lib/audio';
import { setHapticsEnabled } from '../lib/haptics';

const THEME_COLORS = { light: '#FAF8F3', dark: '#1D1A17' } as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

export function useSettings(store: KeyValueStore) {
  const [settings, setSettings] = useState<Settings>(() =>
    // First visit: honour the OS reduced-motion preference as the default.
    loadSettings(store, { ...DEFAULT_SETTINGS, animations: !prefersReducedMotion() }),
  );
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    root.classList.toggle('no-anim', !settings.animations);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolvedTheme]);
  }, [resolvedTheme, settings.animations]);

  useEffect(() => {
    sound.enabled = settings.sound;
    setHapticsEnabled(settings.haptics);
  }, [settings.sound, settings.haptics]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(store, next);
        return next;
      });
      if (patch.sound) {
        // Enabling sound is itself a user gesture: unlock audio right away.
        sound.enabled = true;
        sound.unlock();
        sound.tap();
      }
    },
    [store],
  );

  return { settings, update, resolvedTheme };
}
