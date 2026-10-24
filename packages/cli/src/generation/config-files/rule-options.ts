import { GspotError } from '#cli/system/errors.ts';
import type { RuleOptionsRun } from '#cli/types/generation/files.ts';

/**
 * Refuse options for rules that do not run at the selected level.
 *
 * @param options the requested rules and the rules that each level runs.
 * @param options.chosen the rules with user options.
 * @param options.running the rules that run.
 * @param options.higher the rules reserved for level all.
 * @param options.level the selected checking level.
 */
export function assertRuleOptionsRun({ chosen, running, higher, level }: RuleOptionsRun): void {
    const refused = chosen.filter((rule) => !running.has(rule));
    if (refused.length === 0) return;
    throw new GspotError(
        'settings',
        refused
            .map((rule) =>
                higher.has(rule)
                    ? `${rule} runs only at level all. gspot sets options only for the rules that run at level ${level}.`
                    : `gspot runs ${rule} at no level, so it takes no options.`,
            )
            .join('\n'),
    );
}
