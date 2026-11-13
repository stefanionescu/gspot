import { readConfigurations } from '#cli/manifests/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { formatSimilarNames } from '#cli/system/text/messages.ts';
import type { Check, Configuration, ConfigurationCheck } from '#cli/types/manifests.ts';

const shipped: { checks?: Map<string, ConfigurationCheck> } = {};

export function listChecksById(configurations: Iterable<Configuration>): Map<string, ConfigurationCheck> {
    const checks = new Map<string, ConfigurationCheck>();
    for (const configuration of configurations) {
        for (const check of configuration.checks) {
            checks.set(check.id, { check, configuration });
        }
    }
    return checks;
}

export function readShippedChecks(): ReadonlyMap<string, ConfigurationCheck> {
    shipped.checks ??= listChecksById(readConfigurations().values());
    return shipped.checks;
}

export function listCheckIds(checks: ReadonlyArray<Pick<Check, 'id'>>): string[] {
    const authored = checks.map((check) => check.id);
    return [...readShippedChecks().keys(), ...authored];
}

export function formatUnknownCheck(checkId: string, checkIds: string[]): string {
    return `There is no check called ${checkId}.${formatSimilarNames(checkId, checkIds)}`;
}

export function assertCheckExists(checkId: string, commandChecks: ReadonlyArray<Pick<Check, 'id'>>): void {
    const checkIds = listCheckIds(commandChecks);
    if (!checkIds.includes(checkId)) throw new GspotError('arguments', formatUnknownCheck(checkId, checkIds));
}

/**
Find a check by its id among the command checks of the user's repository, then among the checks that gspot ships.

@param commandChecks undefined when the user's repository has no settings file.
@returns the check, with the configuration that ships it when one does.
*/
export function findCheck(
    checkId: string,
    commandChecks: Readonly<Record<string, Check>> | undefined,
): { check: Check; configuration: Configuration | undefined } | undefined {
    const commandCheck = commandChecks?.[checkId];
    if (commandCheck !== undefined) return { check: commandCheck, configuration: undefined };
    return readShippedChecks().get(checkId);
}
