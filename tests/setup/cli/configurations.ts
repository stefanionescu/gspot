import { parse } from '@decimalturn/toml-patch';
import { manifestSchema } from '#cli/schemas/configurations/manifest.ts';
import { type Check, type Configuration } from '#cli/types/configurations.ts';
import { listChecksById, readConfigurations } from '#cli/configurations/manifests.ts';

/**
List the shipped configurations that gspot selects in every repository.
*/
export function listAlwaysSelected(): string[] {
    return readConfigurations()
        .values()
        .filter((configuration) => configuration.always_selected)
        .map((configuration) => configuration.name)
        .toArray();
}

/**
Parse a manifest.toml for one test, with fields.tables appended as TOML.
*/
export function buildConfiguration(
    name: string,
    fields: { requires?: string[]; tables?: string; group?: Configuration['group'] } = {},
): Configuration {
    const parsed = manifestSchema.parse({
        ...parse(fields.tables ?? ''),
        folder: `configurations/${fields.group ?? 'language'}/${name}`,
        configuration: {
            name,
            title: name,
            group: fields.group ?? 'language',
            requires: fields.requires ?? [],
            description: 'A configuration for the tests, long enough.',
        },
    });
    const { configuration, ...rest } = parsed;
    return {
        ...rest,
        ...configuration,
        tools: [],
    };
}

/**
Read one shipped check by ID, rejecting unknown names.
*/
export function getShippedCheck(checkId: string): Check {
    const declaration = listChecksById(readConfigurations().values()).get(checkId);
    if (declaration === undefined) throw new Error(`The shipped check ${checkId} does not exist.`);
    return declaration.check;
}
