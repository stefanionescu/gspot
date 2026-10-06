import type { Linter } from 'eslint';

/** Framework settings emitted for the selected Next.js project. */
export type NextEslintConfiguration = Omit<Linter.Config, 'settings'> & { settings: { next: { rootDir: string } } };
