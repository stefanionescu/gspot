import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { ROOT_RUNS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
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

export function extractConfigName(file: string): string {
    const name = posix.basename(file);
    const dot = name.indexOf('.');
    return dot === -1 ? name : name.slice(0, dot);
}

export function isRepositoryRun(check: Pick<Check, 'runs'>): boolean {
    return (ROOT_RUNS as readonly string[]).includes(check.runs);
}

/**
Check whether a per-file check of a general or always-selected configuration runs once at the root. A check that reads
a scope config file does not.
*/
export function isRootOnlyCheck(configuration: Configuration | undefined, check: Check): boolean {
    if (configuration === undefined) return true;
    const isEveryScope = configuration.group === 'general' || configuration.always_selected;
    if (!isEveryScope || configuration.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return configuration.configs.every(
        (config) =>
            !(
                config.per_scope &&
                (config.check.includes(check.id) ||
                    command.some((argument) => argument.includes(`{config_file:${extractConfigName(config.file)}}`)))
            ),
    );
}
