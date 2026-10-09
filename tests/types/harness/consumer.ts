import type { Finding } from '#cli/types/parsers/output.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { AsyncSpawnOptions } from '#cli/types/platform/runtime.ts';
import type { CheckCaseOutcome } from '#tests/types/harness/check-case.ts';

/** The working directory, environment, and limit owned by an installed-consumer command. */
export type ConsumerOptions = Required<Pick<AsyncSpawnOptions, 'cwd' | 'env'>>;

/** A fresh consumer of the release: its install, its folder, the command that runs gspot, and the options it runs with. */
export type Consumer = {
    root: string;
    command: string[];
    /** Check commands cannot reach the network. */
    offlineOptions: ConsumerOptions;
    /** Acquisition commands can reach the isolated registry and its upstream. */
    onlineOptions: ConsumerOptions;
    workspace: string;
    [Symbol.asyncDispose]: () => Promise<void>;
};

/** A delivered check's test findings and the explicit operation that corrects them. */
export type PackageCheckCase = {
    only: string;
    path: string;
    sample?: string;
    findings: Partial<Finding>[];
    isNpm?: boolean;
} & ({ corrected: string } | { fix: true });

/** Raw process evidence and parsed reports for the owning test's finding and fix assertions. */
export type PackageCheckOutcome = CheckCaseOutcome & {
    fixed: SpawnOutcome | undefined;
};
