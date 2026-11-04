import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every test runs with a throwaway home folder: none may touch the real
    // ~/.claude, ~/.codex or ~/.cursor of the person running them.
    setupFiles: ['./src/__tests__/setup-home.ts'],
  },
});
