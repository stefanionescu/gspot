import type { ManagedKeys } from '#cli/types/repository/writer.ts';

export type PackageFieldScenario = {
    project: Readonly<Record<string, string>>;
    configurations: readonly string[];
    tables: string;
    unchanged: readonly string[];
    changes: ManagedKeys[];
};
