import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Slot/day assignment uses local time; pin the zone so tests are deterministic.
process.env.TZ = 'Europe/Berlin';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: { include: ['src/engine/**', 'src/lib/slots.ts'], exclude: ['src/engine/__tests__/**'] },
  },
});
