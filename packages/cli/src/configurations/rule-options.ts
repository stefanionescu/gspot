import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { RuleOptionsRun } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

export function assertRunningRuleOptions({ configured, running, allLevelRules, level }: RuleOptionsRun): void {
    const refused = configured.filter((rule) => !running.has(rule));
    if (refused.length === 0) return;
    throw new GspotError(
        'settings',
        refused
            .map((rule) =>
                allLevelRules.has(rule)
                    ? `${rule} runs only at level all. gspot sets options only for the rules that run at level ${level}.`
                    : `gspot does not run ${rule} at level ${level}, so it takes no options.`,
            )
            .join('\n'),
    );
}

export function readToolDisabledRules(planned: Pick<PlannedConfig, 'config'>): {
    always: string[];
    levelOff: string[];
} {
    const tools = planned.config.tool.map((name) => getTool(readConfigurations().values(), name));
    return {
        always: tools.flatMap(({ off }) => off?.always ?? []),
        levelOff: tools.flatMap(({ off }) => off?.basic ?? []),
    };
}

export function listDisabledRules(
    planned: Pick<PlannedConfig, 'config' | 'configuration' | 'scope' | 'level'>,
): string[] {
    const { config, configuration, scope, level } = planned;
    const { always, levelOff } = readToolDisabledRules(planned);
    const checks = configuration.checks.filter((check) => {
        const tools = new Set([check.tool ?? check.command?.[0] ?? []].flat());
        return config.tool.some((name) => tools.has(name));
    });
    return [
        ...new Set([
            ...checks.flatMap((check) => listIgnoredRules(scope, check.id)),
            ...always,
            ...(level === 'all' ? [] : levelOff),
        ]),
    ];
}
