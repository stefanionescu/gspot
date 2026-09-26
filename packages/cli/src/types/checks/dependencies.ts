// The types of checks/dependencies in this package.
import type { Finding } from '#cli/types/checks/checks.ts';

export type Reporter = (file: string, rule: string, text: string) => Finding;
