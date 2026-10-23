// Builds configurations for tests and reads the shipped ones and their checks.
import { parse } from '@decimalturn/toml-patch';
import { getTool } from '#cli/configurations/tools.ts';
import { manifestSchema } from '#cli/schemas/configurations/manifest.ts';
import { type Check, type Configuration } from '#cli/types/configurations.ts';
import { listChecksById, readConfigurations } from '#cli/configurations/manifests.ts';

/**
 * List the shipped configurations that gspot selects in every repository.
 *
 * @returns their names.
 */
export function listAlwaysSelected(): string[] {
    return [...readConfigurations().values()]
        .filter((configuration) => configuration.always_selected)
        .map((configuration) => configuration.name);
}

/**
 * Parse a manifest.toml for one test.
 *
 * @param name what to call the configuration.
 * @param fields extra manifest tables and fields.
 * @param fields.requires configurations that it needs.
 * @param fields.tables extra TOML for the manifest.
 * @param fields.group where the configuration sits.
 * @returns the parsed configuration.
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
    const { configuration, tools, ...rest } = parsed;
    return {
        ...rest,
        ...configuration,
        tools: tools.map((tool) => (typeof tool === 'string' ? getTool(readConfigurations().values(), tool) : tool)),
    };
}

/** Read one shipped check by ID, rejecting unknown names. */
export function getShippedCheck(name: string): Check {
    const declaration = listChecksById(readConfigurations().values()).get(name);
    if (declaration === undefined) throw new Error(`The shipped check ${name} does not exist.`);
    return declaration.check;
}
