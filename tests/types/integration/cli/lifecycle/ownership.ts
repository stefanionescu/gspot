// The types of integration/cli/lifecycle/ownership in this package.
import type { TestdirResult } from 'testdirs';

export type Point = 'error' | 'restoration error' | 'interruption' | 'edited';
/** A replacement published up to a failure point: the original bytes and the target. */
export type Published = { directory: TestdirResult; original: NonSharedBuffer; destination: string };
