import type { OutdatedFile } from '#cli/types/generation/files.ts';

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

export type DryRunJson = {
    dryRun: true;
    pin: { from: string | undefined; to: string };
    outdated: OutdatedFile[];
};
