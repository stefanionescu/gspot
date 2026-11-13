import { CONFIG_PLACEHOLDER, POINTER_PLACEHOLDER } from '#cli/config/engine.ts';
import { extractConfigName } from '#cli/manifests/checks.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { Config } from '#cli/types/manifests.ts';

function listConfigs(planned: PlannedCheck): Config[] {
    const own = planned.scope.configurations
        .filter((configuration) => configuration.checks.some((check) => check.id === planned.check.id))
        .flatMap((configuration) => configuration.configs);
    const every = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.configs)
        .toArray();
    return [...own, ...every];
}

export function selectPointerPath(session: CheckSession, scopePath: string, name: string): string {
    const path = joinScope(scopePath, name);
    const generated = listGeneratedPaths(session.repository.files);
    return !generated.has(path) && generated.has(name) ? name : path;
}

export function getConfigTarget(scopePath: string, config: Config, configs: ConfigTargets): string {
    const failure = configs.failures.get(scopePath)?.get(config.target);
    if (failure !== undefined) throw failure;
    return config.per_scope ? (configs.targets.get(scopePath)?.get(config.target) ?? config.target) : config.target;
}

export function getConfigPath(session: CheckSession, planned: PlannedCheck, name: string): string {
    const config = listConfigs(planned).find(({ file }) => extractConfigName(file) === name);
    if (!config)
        throw new GspotError(
            'settings',
            `Check ${planned.check.id} names {config_file:${name}} and no configuration writes it.`,
        );
    return getConfigTarget(planned.scope.path, config, session.generation.buildConfigs(session));
}

export function listCommandConfigs(session: CheckSession, planned: PlannedCheck, command: readonly string[]): string[] {
    const words = [...command, ...(planned.check.env === undefined ? [] : Object.values(planned.check.env))];
    const scopePath = planned.scope.path;
    return [
        ...new Set(
            words.flatMap((segment) => {
                const configured = segment
                    .matchAll(CONFIG_PLACEHOLDER)
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => getConfigPath(session, planned, name))
                    .toArray();
                const pointed = segment
                    .matchAll(POINTER_PLACEHOLDER)
                    .map((match) => match.groups?.['name'])
                    .filter((name) => name !== undefined)
                    .map((name) => selectPointerPath(session, scopePath, name))
                    .toArray();
                return [...configured, ...pointed];
            }),
        ),
    ].toSorted((left, right) => compareText(left, right));
}

export function listCopyFiles(session: CheckSession, planned: PlannedCheck, command: string[]): string[] {
    const scopePath = planned.scope.path;
    const owned = (planned.configuration?.configs ?? []).map((config) =>
        getConfigTarget(scopePath, config, session.generation.buildConfigs(session)),
    );
    return [
        ...new Set([
            ...planned.files.map(({ path }) => path),
            ...listCommandConfigs(session, planned, command),
            ...owned,
        ]),
    ];
}
