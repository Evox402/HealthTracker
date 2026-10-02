import { useCallback, useState } from 'react';

const KEY = 'ackedRedFlags';

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Red flags the user confirmed they reported. Per-device convenience only. */
export function useAckedFlags(): [Set<string>, (key: string) => void] {
  const [acked, setAcked] = useState(() => new Set(read()));
  const ack = useCallback((key: string) => {
    setAcked((prev) => {
      const next = new Set(prev).add(key);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next].slice(-200)));
      } catch {
        // Storage blocked: keep the in-memory state.
      }
      return next;
    });
  }, []);
  return [acked, ack];
}
