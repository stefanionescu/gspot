import type { Manifest, ParsedManifest, ToolFileDeclaration } from '#cli/types/configurations.ts';

export type Fragment = { manifest: Manifest; toolFile: ToolFileDeclaration };

/** A fragment selector with the allowed setting replaced by the paths it holds. */
export type SelectorPaths = Pick<FragmentSelector, 'selector' | 'message' | 'files'> & { except?: string[] };

export type FragmentSelector = ParsedManifest['toolFiles'][number]['selectors'][number];
