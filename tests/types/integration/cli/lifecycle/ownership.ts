// The types of integration/cli/lifecycle/ownership in this package.
import type { TestDirectory } from '#tests/types/support/cli.ts';

export type Point = 'success' | 'error' | 'restoration error' | 'interruption' | 'edited' | 'damaged backup';
/** A replacement published up to a failure point: the original bytes, the target, and the backup the owner took. */
export type Published = {
    directory: TestDirectory;
    original: NonSharedBuffer;
    destination: string;
    backup: string | undefined;
};
