import type { Read } from '#cli/types/platform.ts';
import type { Generated } from '#cli/types/generation.ts';
import type { ApplyReport } from '#cli/types/lifecycle/lifecycle.ts';

export type WriteRequest = {
    root: string;
    rendered: Generated;
    report: ApplyReport;
    retained: { prose: boolean; packages: boolean };
    replace?: ReadonlyMap<string, Read> | undefined;
    regenerate?: ReadonlyMap<string, Read>;
};
