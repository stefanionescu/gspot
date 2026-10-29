import type { NumberedLine } from '#cli/types/text.ts';

export type TaskNames = { mise: Set<string>; scripts: Set<string>; binaries: Set<string> };

export type PathIndex = {
    paths: Set<string>;
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};

export type ProseLine = NumberedLine & { command: boolean };
