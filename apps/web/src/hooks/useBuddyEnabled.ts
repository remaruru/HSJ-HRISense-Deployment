import { useCallback, useEffect, useState } from 'react';

/**
 * Whether the HRISense buddy (the AI mascot that peeks in from the screen
 * edge) is shown. Remembered on this device, like the theme; on by default.
 * Every component using the hook stays in step, in this tab and others.
 */
const KEY = 'hrisense.buddy.enabled';
const EVENT = 'hrisense:buddy-change';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function useBuddyEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(read);

  useEffect(() => {
    const sync = () => setEnabled(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable — the choice lasts until the page is reloaded */
    }
    setEnabled(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [enabled, update];
}
