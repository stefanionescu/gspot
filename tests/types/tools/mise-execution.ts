import type { NonSharedBuffer } from 'node:buffer';

export type MiseProject = {
    root: string;
    state: string;
    policy: string;
    generated: NonSharedBuffer;
    environment: Record<string, string> & { PATH: string };
};
