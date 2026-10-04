import type { Manifest, RawManifest, ConfigurationFile } from '#cli/types/configurations.ts';

export type Fragment = { manifest: Manifest; config: ConfigurationFile };

/** A fragment selector with the allowed setting replaced by the paths it holds. */
export type ResolvedSelector = Pick<FragmentSelector, 'selector' | 'message' | 'files'> & { except?: string[] };

export type FragmentSelector = RawManifest['configs'][number]['selectors'][number];
