import type { TestdirResult } from 'testdirs';

export type PublicationProject = { directory: TestdirResult; original: NonSharedBuffer; destination: string };
