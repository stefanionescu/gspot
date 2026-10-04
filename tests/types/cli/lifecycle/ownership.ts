import type { TestdirResult } from 'testdirs';

/** The fixture contract owned by this behavior's tests. */
export type PublicationProject = { directory: TestdirResult; original: NonSharedBuffer; destination: string };
