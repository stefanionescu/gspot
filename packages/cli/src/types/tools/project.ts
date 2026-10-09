import type { ToolOwner } from '#cli/types/tools/install.ts';
import type { InstallationKind } from '#cli/types/configurations.ts';

/** Native installation phases, in execution order. */
export type ToolProjectPlan = { installer: string[][]; lockfile: string[][]; environment: string[][] };

/** Both immutable-input checks, called at the native installer's required verification boundaries. */
export type ToolProjectGuards = { scratch(message: string): void; source(message: string): void };

/** One validated project and its native resolution and installation behavior. */
export type ToolProject<Parsed, Preparation, Installation> = {
    manifestPath: string;
    kind: InstallationKind;
    additionalPaths: readonly string[];
    lockfilePrefix: string;
    installPrefix: string;
    parse(manifest: string): Parsed;
    lockfilePath(project: Parsed): string;
    matches(project: Parsed, lockfile: string | undefined): boolean;
    current(
        project: Parsed,
        recorded: string | undefined,
        manifest: string,
        owner: Pick<ToolOwner, 'read'>,
        preparation: Preparation,
    ): string | undefined;
    commands(project: Parsed, runner: string | undefined): ToolProjectPlan;
    createLockfile(
        work: string,
        preparation: Preparation,
        recorded: string | undefined,
        project: Parsed,
    ): Promise<string>;
    install(work: string, installation: Installation, guards: ToolProjectGuards, project: Parsed): Promise<string>;
};
