import type { ParsedManifest } from '#cli/types/configurations.ts';

type FragmentSelector = ParsedManifest['eslint']['selectors'][number];

/** A fragment selector with its resolved source paths. */
export type SelectorPaths = Pick<FragmentSelector, 'selector' | 'message'> & { files?: string[]; except?: string[] };
