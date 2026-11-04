import { GspotError } from '#cli/system/errors.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { DOCS_PATHS, SOURCE_FILE_GROUPS } from '#cli/config/manifests.ts';
import { type Configuration, type WrittenConfiguration } from '#cli/types/manifests.ts';

type RequirementWalk = { errors: string[]; order: Configuration[]; seen: Set<string> };

function addRequiredConfigurations(walk: RequirementWalk, name: string): void {
    if (walk.seen.has(name)) return;
    walk.seen.add(name);
    const configuration = readConfigurations().get(name);
    if (!configuration) {
        walk.errors.push(...listUnknownConfigurations([{ name }]).map(({ message }) => message));
        return;
    }
    for (const required of configuration.requires) addRequiredConfigurations(walk, required);
    walk.order.push(configuration);
}

/**
Resolve configuration names to configurations in order, and throw for unknown names.

@param names the names to resolve.
@returns the configurations, requirements first, in order of first mention.
*/
export function selectConfigurations(names: string[]): Configuration[] {
    const walk: RequirementWalk = { errors: [], order: [], seen: new Set() };
    for (const configurationName of names) addRequiredConfigurations(walk, configurationName);
    if (walk.errors.length > 0) throw new GspotError('arguments', walk.errors.join('\n'));
    return walk.order;
}

/**
Keep the language and framework configurations that add source files to shared checks.

@param configurations the configurations in use.
*/
export function listSourceConfigurations(configurations: Configuration[]): Configuration[] {
    const groups: readonly string[] = SOURCE_FILE_GROUPS;
    return configurations.filter((configuration) => groups.includes(configuration.group));
}

/**
List each configuration of the scopes once, in first-seen order.

@param scopes the scopes, which can share configurations.
*/
export function listSelectedConfigurations(
    scopes: ReadonlyArray<{ configurations: Configuration[] }>,
): Configuration[] {
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
*/
export function isConfigurationSelected(
    scopes: ReadonlyArray<{ configurations: Configuration[] }>,
    name: string,
): boolean {
    return scopes.some((scope) => scope.configurations.some((configuration) => configuration.name === name));
}

/**
Find the unknown configuration names, and keep their order and location.

@param written the requested names, with their original fields.
*/
export function listUnknownConfigurations<Written extends Pick<WrittenConfiguration, 'name'>>(
    written: readonly Written[],
): Array<Written & { message: string }> {
    const configurations = readConfigurations();
    const available = configurations.keys().toArray();
    return written
        .filter(({ name }) => !configurations.has(name))
        .map((missing) => ({
            ...missing,
            message: `There is no configuration called ${missing.name}.${formatSimilarNames(missing.name, available)} See ${DOCS_PATHS.configurations} for the available configurations.`,
        }));
}

/**
Refuse explicit edits to configurations that gspot selects itself.

@param names the configurations that the command edits.
*/
export function assertConfigurationsEditable(names: string[]): void {
    const name = names.find((each) => readConfigurations().get(each)?.always_selected === true);
    if (name !== undefined)
        throw new GspotError(
            'arguments',
            `gspot selects ${name} by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To ignore one check, run gspot ignore.`,
        );
}

/**
Refuse every unknown configuration named by a command.

@param names the requested configuration names.
*/
export function assertConfigurationsExist(names: string[]): void {
    const unknown = listUnknownConfigurations(names.map((name) => ({ name })));
    if (unknown.length > 0) throw new GspotError('arguments', unknown.map(({ message }) => message).join('\n'));
}

/**
Include suggested configurations when their detection has evidence or they need none.

@param names the configurations already chosen.
@param detected the configurations with detection evidence.
@returns chosen names and applicable suggestions, once each.
*/
export function expandSuggestions(names: string[], detected: Set<string>): string[] {
    const configurations = readConfigurations();
    const suggestions = names.flatMap((name) => configurations.get(name)?.suggests ?? []);
    return [
        ...new Set([
            ...names,
            ...suggestions.filter((name) => {
                const configuration = configurations.get(name);
                const hasDetection =
                    configuration !== undefined &&
                    Object.values(configuration.detect).some((patterns) => Object.keys(patterns).length > 0);
                return !hasDetection || detected.has(name);
            }),
        ]),
    ];
}
