import { GspotError } from '#cli/system/errors.ts';
import type { RuleOptionsRun } from '#cli/types/generation/files.ts';

/**
Refuse options for rules that do not run at the selected level.

@param options the requested rules and the rules that each level runs.
@param options.configured the rules with user options.
@param options.running the rules that run.
@param options.allLevelRules the rules reserved for level all.
@param options.level the selected checking level.
@param options.suffix the tool-specific help after an unknown rule.
*/
export function assertRuleOptionsRun({ configured, running, allLevelRules, level, suffix = '' }: RuleOptionsRun): void {
    const refused = configured.filter((rule) => !running.has(rule));
    if (refused.length === 0) return;
    throw new GspotError(
        'settings',
        refused
            .map((rule) =>
                allLevelRules.has(rule)
                    ? `${rule} runs only at level all. gspot sets options only for the rules that run at level ${level}.`
                    : `gspot runs ${rule} at no level, so it takes no options.${suffix}`,
            )
            .join('\n'),
    );
}
