// The docs analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { fences } from '#cli/checks/docs/fences.ts';
import { docsHeadings } from '#cli/checks/docs/headings.ts';
import { stalePaths } from '#cli/checks/docs/stale-paths.ts';
import { readmeShape } from '#cli/checks/docs/readme/shape.ts';
import { copiedBlocks } from '#cli/checks/docs/copied-blocks.ts';
import { readmePresent } from '#cli/checks/docs/readme/present.ts';

export const DOCS_ANALYSES: Record<string, Engine> = {
    'docs-headings': docsHeadings,
    'stale-paths': stalePaths,
    'readme-present': readmePresent,
    'readme-shape': readmeShape,
    fences,
    'copied-blocks': copiedBlocks,
};
