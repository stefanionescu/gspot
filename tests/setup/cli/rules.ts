import { type Session } from '#cli/types/session.ts';
import { type Level } from '#cli/types/configurations.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { type RuleFile } from '#cli/types/generation/rules.ts';

/** Select rule files at one level without changing the session's saved settings. */
export function selectRulesAt(session: Session, level: Level, scopes: Session['scopes']): RuleFile[] {
    return selectRuleFiles({
        ...session,
        scopes,
        settingsFile: { ...session.settingsFile, settings: { ...session.settingsFile.settings, level } },
    });
}
