import type { AppDB } from './db';
import { DEFAULT_PARAMETERS, DEFAULT_SLOTS, DEFAULT_SYMPTOMS } from './defaults';
import type { AppSettings } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  disclaimerAcceptedAt: null,
  theme: 'dark',
  analysisWindowDays: 7,
  excludeTags: ['after_activity'],
  dismissedInsightKeys: [],
  lastBackupAt: null,
};

/** First launch: inserts the defaults in one transaction, only if there are no settings yet. */
export async function ensureSeeded(db: AppDB): Promise<void> {
  await db.transaction('rw', db.allTables, async () => {
    if ((await db.settings.count()) > 0) return;
    await db.parameters.bulkPut(structuredClone(DEFAULT_PARAMETERS));
    await db.symptoms.bulkPut(structuredClone(DEFAULT_SYMPTOMS));
    await db.slots.bulkPut(structuredClone(DEFAULT_SLOTS));
    await db.settings.put(structuredClone(DEFAULT_SETTINGS));
  });
}
