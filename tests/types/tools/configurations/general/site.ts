import type { Level } from '#cli/types/configurations.ts';
import type { Finding } from '#cli/types/parsers/output.ts';

/** Native built-site inputs and the finding that disappears after their fix. */
export type SiteOutputCase = {
    name: string;
    check: 'site/linkinator' | 'site/html-validate' | 'site/purgecss';
    body: string;
    finding: Partial<Finding>;
    files?: Record<string, string> & { 'orphan.html': string };
    level?: Level;
};
