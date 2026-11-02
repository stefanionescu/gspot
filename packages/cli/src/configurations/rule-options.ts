import { getTool } from '#cli/tools/pins.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { RuleOptionsRun } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

/**
Refuse options for rules that do not run at the selected level.

@param options the requested rules and the rules that each level runs.
@param options.configured the rules with user options.
@param options.running the rules that run.
@param options.allLevelRules the rules reserved for level all.
@param options.level the selected checking level.
*/
export function assertRunningRuleOptions({ configured, running, allLevelRules, level }: RuleOptionsRun): void {
    const refused = configured.filter((rule) => !running.has(rule));
    if (refused.length === 0) return;
    throw new GspotError(
        'settings',
        refused
            .map((rule) =>
                allLevelRules.has(rule)
                    ? `${rule} runs only at level all. gspot sets options only for the rules that run at level ${level}.`
                    : `gspot runs ${rule} at no level, so it takes no options.`,
            )
            .join('\n'),
    );
}

/**
Read the rules that the tool of a config file turns off, by the level that turns them off.

@param planned the config file.
@returns the rules that stay off at every level, and the rules that level basic leaves off.
*/
export function readToolOffRules(planned: Pick<PlannedConfig, 'config'>): { always: string[]; levelOff: string[] } {
    const tools = planned.config.tool.map((name) => getTool(readConfigurations().values(), name));
    return {
        always: tools.flatMap(({ off }) => off?.always ?? []),
        levelOff: tools.flatMap(({ off }) => off?.basic ?? []),
    };
}

/**
List the rules that a config file turns off: the ignored rules of the checks that read it, and the rules that its tool
leaves off at this level.

@param planned the config file, its configuration, and the level.
*/
export function listOffRules(planned: Pick<PlannedConfig, 'config' | 'configuration' | 'scope' | 'level'>): string[] {
    const { config, configuration, scope, level } = planned;
    const { always, levelOff } = readToolOffRules(planned);
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
