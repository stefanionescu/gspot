import type { Manifest, ParsedManifest, ToolFileDeclaration } from '#cli/types/configurations.ts';

type FragmentSelector = ParsedManifest['eslint']['selectors'][number];

export type Fragment = { manifest: Manifest; toolFile: ToolFileDeclaration };

/** A fragment selector with the allowed setting replaced by the paths it holds. */
export type SelectorPaths = Pick<FragmentSelector, 'selector' | 'message' | 'files'> & { except?: string[] };

export type TypescriptImports = { imports: string[]; body: string };
