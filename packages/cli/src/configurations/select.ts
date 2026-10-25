import { GspotError } from '#cli/system/errors.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { SOURCE_FILE_GROUPS } from '#cli/config/configurations/select.ts';
import { type Configuration, type RequirementWalk, type WrittenConfiguration } from '#cli/types/configurations.ts';

function addRequiredConfigurations(walk: RequirementWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    walk.seen.add(configurationName);
    const configuration = walk.configurationsByName.get(configurationName);
    if (!configuration) {
        const names = walk.configurationsByName.keys().toArray();
        walk.errors.push(formatUnknownConfiguration(configurationName, names));
        return;
    }
    for (const required of configuration.requires) addRequiredConfigurations(walk, required);
    walk.order.push(configuration);
}

/**
Resolve configuration names to configurations in order, and throw for unknown names.

@param configurationNames the names to resolve.
@param configurationsByName every configuration.
@returns the configurations, requirements first, in order of first mention.
*/
export function selectConfigurations(
    configurationNames: string[],
    configurationsByName: Map<string, Configuration>,
): Configuration[] {
    const walk: RequirementWalk = {
        configurationsByName,
        errors: [],
        order: [],
        seen: new Set(),
    };
    for (const configurationName of configurationNames) addRequiredConfigurations(walk, configurationName);
    if (walk.errors.length > 0) throw new GspotError('arguments', walk.errors.join('\n'));
    return walk.order;
}

/**
Keep the language and framework configurations that add source files to shared checks.

@param configurations the configurations in use.
@returns the configurations that own source settings.
*/
export function filterSourceConfigurations(configurations: Configuration[]): Configuration[] {
    const groups: readonly string[] = SOURCE_FILE_GROUPS;
    return configurations.filter((configuration) => groups.includes(configuration.group));
}

/**
List each configuration of the scopes once, in first-seen order.

@param scopes the scopes, which can share configurations.
@returns each configuration once.
*/
export function listSelectedConfigurations(scopes: Pick<Scope, 'configurations'>[]): Configuration[] {
    const seen = new Map<string, Configuration>();
    for (const scope of scopes)
        for (const configuration of scope.configurations)
            if (!seen.has(configuration.name)) seen.set(configuration.name, configuration);
    return seen.values().toArray();
}

/**
Check whether any scope selects a configuration.

@param scopes the validated scopes.
@param name the configuration to find.
@returns whether any scope includes the configuration.
*/
export function isConfigurationSelected(scopes: Pick<Scope, 'configurations'>[], name: string): boolean {
    return scopes.some((scope) => scope.configurations.some((configuration) => configuration.name === name));
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function formatUnknownConfiguration(name: string, available: string[]): string {
    return `There is no configuration called \`${name}\`.${formatSimilarNames(name, available)} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
Find the unknown configuration names, and keep their order and location.

@param written the requested names, with their original fields.
@param configurationsByName the shipped configurations.
@returns each unknown name with its error message.
*/
export function listUnknownConfigurations<Written extends Pick<WrittenConfiguration, 'name'>>(
    written: readonly Written[],
    configurationsByName: ReadonlyMap<string, Configuration>,
): (Written & { message: string })[] {
    const available = configurationsByName.keys().toArray();
    return written
        .filter(({ name }) => !configurationsByName.has(name))
        .map((missing) => ({
            ...missing,
            message: formatUnknownConfiguration(missing.name, available),
        }));
}

/**
Refuse explicit edits to configurations that gspot selects itself.

@param names the configurations that the command edits.
@param configurationsByName the shipped configurations
*/
export function assertConfigurationsEditable(names: string[], configurationsByName: Map<string, Configuration>): void {
    const name = names.find((each) => configurationsByName.get(each)?.always_selected === true);
    if (name !== undefined)
        throw new GspotError(
            'arguments',
            `gspot selects ${name} by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To turn one check off, run gspot ignore.`,
        );
}

/**
Refuse every unknown configuration named by a command.

@param names the requested configuration names.
@param configurationsByName every available configuration.
*/
export function assertConfigurationsExist(names: string[], configurationsByName: Map<string, Configuration>): void {
    const unknown = listUnknownConfigurations(
        names.map((name) => ({ name })),
        configurationsByName,
    );
    if (unknown.length > 0) throw new GspotError('arguments', unknown.map(({ message }) => message).join('\n'));
}

/**
Include suggested configurations when their detection has evidence or they need none.

@param names the configurations already chosen.
@param configurationsByName every shipped configuration.
@param detected the configurations with detection evidence.
@returns chosen names and applicable suggestions, once each.
*/
export function expandSuggestions(
    names: string[],
    configurationsByName: Map<string, Configuration>,
    detected: Set<string>,
): string[] {
    const suggestions = names.flatMap((name) => configurationsByName.get(name)?.suggests ?? []);
    return [
        ...new Set([
            ...names,
            ...suggestions.filter((name) => {
                const configuration = configurationsByName.get(name);
                const hasDetection =
                    configuration !== undefined &&
                    Object.values(configuration.detect).some((patterns) => Object.keys(patterns).length > 0);
                return !hasDetection || detected.has(name);
            }),
        ]),
    ];
}
