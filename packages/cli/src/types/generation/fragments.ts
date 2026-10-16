import type { Manifest, ParsedManifest, ToolFileDeclaration } from '#cli/types/configurations.ts';

type FragmentSelector = ParsedManifest['eslint']['selectors'][number];

export type Fragment = { manifest: Manifest; toolFile: ToolFileDeclaration };

/** A fragment selector with its resolved source paths. */
export type SelectorPaths = Pick<FragmentSelector, 'selector' | 'message'> & { files?: string[]; except?: string[] };
