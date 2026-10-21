import type { ManifestDeclaration } from '#cli/types/configurations.ts';

type FragmentSelector = ManifestDeclaration['eslint']['selectors'][number];

/** A fragment selector with its resolved source paths. */
export type SelectorPaths = Pick<FragmentSelector, 'selector' | 'message'> & { files?: string[]; except?: string[] };
