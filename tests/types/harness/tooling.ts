import type { Manifest } from '#cli/types/configurations.ts';

/** Authored declarations and identity for one isolated configuration fixture. */
export type TestManifest = {
    requires?: string[];
    tables?: string;
    kind?: Manifest['configuration']['kind'];
};
