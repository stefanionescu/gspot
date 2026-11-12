import { explainCheck, explainLintRule } from '#cli/commands/explain/check.ts';
import { explainConfiguration } from '#cli/commands/explain/configuration.ts';
import { explainPath } from '#cli/commands/explain/path.ts';
import { explainSetting } from '#cli/commands/explain/setting.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { listCheckIds, readConfigurations } from '#cli/manifests/read.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { listInheritedSettings } from '#cli/settings/inherit.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import type { CommandDefinition, Explanation } from '#cli/types/commands.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

function formatUnknownSubject(session: Session | undefined, subject: string): string {
    if (SETTINGS_BY_CONFIGURATION.values().some((settings) => settings.some(({ name }) => name === subject)))
        return formatUnknownSetting(subject, { available: [], offered: new Set() });
    const subjects = [
        ...listCheckIds(session === undefined ? [] : Object.values(session.settings.commandChecks)),
        ...readConfigurations().keys(),
        ...(session?.scopes.flatMap((scope) =>
            listInheritedSettings(scope.availableSettings, session.settings, scope.path).map((setting) => setting.key),
        ) ?? []),
    ];
    const similar = formatSimilarNames(subject, [...new Set(subjects)]);
    return `There is no check, lint rule, configuration, setting, or file called ${subject}. Give a check (python/ruff), a lint rule (python/ruff E501), a configuration (python), a setting (limits.max_file_lines), or a file (./src/app.ts).${similar}`;
}

async function runExplainCommand(input: {
    subject: string;
    rule: string | undefined;
    verbose: boolean;
    cwd: string;
    root: string;
}): Promise<CommandResult> {
    const { subject, rule, verbose, cwd, root } = input;

    const session = findText(root, SETTINGS_FILE) === undefined ? undefined : await openSession(root);

    const result =
        rule === undefined
            ? explainSubject(session, { subject, cwd })
            : await explainLintRule(root, subject, rule, {
                  verbose,
                  ...(session !== undefined && { session }),
              });
    return {
        text: result.text,
        json: { ...result.facts, kind: result.kind, subject: result.subject },
        exitCode: 0,
    };
}

function explainSubject(session: Session | undefined, { subject, cwd }: { subject: string; cwd: string }): Explanation {
    const file = explainPath(session, subject, cwd);
    if (file !== undefined && subject.startsWith('.')) return file;
    const explanation =
        explainCheck(session, subject, cwd) ??
        explainSetting(session, subject) ??
        explainConfiguration(session, subject) ??
        file;
    if (explanation !== undefined) return explanation;
    throw new GspotError('arguments', formatUnknownSubject(session, subject));
}

export const EXPLAIN_COMMAND: CommandDefinition<
    [string, string | undefined],
    { verbose?: true },
    { subject: string; rule: string | undefined; verbose: boolean; cwd: string }
> = {
    name: 'explain',
    arguments: [{ term: '<subject>' }, { term: '[rule]' }],
    parse: ({ arguments: commandArguments, flags: { verbose }, cwd }) => {
        const [subject, rule] = commandArguments;
        return { subject, rule, verbose: verbose === true, cwd };
    },
    run: runExplainCommand,
};
