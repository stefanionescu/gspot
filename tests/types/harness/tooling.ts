import type { Manifest } from '#cli/types/configurations.ts';

/** Authored declarations and identity for one isolated configuration sample. */
export type TestManifest = {
    requires?: string[];
    tables?: string;
    kind?: Manifest['configuration']['kind'];
};
