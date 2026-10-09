import type { readFile } from 'node:fs/promises';

export type MiseProject = {
    root: string;
    state: string;
    policy: string;
    generated: Exclude<Awaited<ReturnType<typeof readFile>>, string>;
    environment: Record<string, string> & { PATH: string };
};
