import type { Mutation } from '#cli/types/policy/settings.ts';

/** Flags for adding built-in configurations to one policy selection. */
export type AddOptions = { cwd: string; isDryRun: boolean; configurations: string[]; scope?: string };

/** Flags for removing one built-in configuration from a policy selection. */
export type RemoveOptions = { cwd: string; isDryRun: boolean; configuration: string; scope?: string };

/** One validated policy mutation and its public preview or publication request. */
export type ConfigurationChange = {
    mutation: Mutation;
    summary: string;
    isDryRun: boolean;
    overrides: { path: string; added: string[]; removed: string[] };
};

/** The repository and explicit command intent recorded under the lifecycle lock. */
export type ConfigurationOverrideUpdate = { root: string; overrides: ConfigurationChange['overrides'] };
