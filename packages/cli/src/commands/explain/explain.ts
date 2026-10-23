import { readFileSync } from 'node:fs';
import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { findText } from '#cli/system/files/reads.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import type { Command } from '@commander-js/extra-typings';
import { explainPath } from '#cli/commands/explain/path.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { listEffectiveSettings } from '#cli/settings/inherit.ts';
import { explainSetting } from '#cli/commands/explain/setting.ts';
import type { Explanation } from '#cli/types/commands/explain.ts';
import { ESLINT_RULE_NAMES_FILE } from '#cli/config/commands/explain.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/configurations/names.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { explainConfiguration } from '#cli/commands/explain/configuration.ts';
import { explainCheck, explainLintRule } from '#cli/commands/explain/check.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { listCheckIds, readConfigurations } from '#cli/configurations/manifests.ts';

function formatUnknownSubject(session: Session | undefined, subject: string): string {
    const subjects = [
        ...listCheckIds(session === undefined ? [] : Object.values(session.settingsFile.settings.commandChecks)),
        ...readConfigurations().keys(),
        ...(session?.scopes.flatMap((scope) =>
            listEffectiveSettings(scope.availableSettings, session.settingsFile.settings, scope.folder.path).map(
                (setting) => setting.key,
            ),
        ) ?? []),
    ];
    const similar = formatSimilarNames(subject, [...new Set(subjects)]);
    return `gspot cannot explain ${subject}. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).${similar}`;
}

// A check ID wins. A tracked path wins over a lint rule with the same first folder.
function explainSlashed(
    session: Session | undefined,
    subject: string,
    file: Explanation | undefined,
): Explanation | undefined {
    const check = explainCheck(session, subject);
    if (check !== undefined) return check;
    if (file !== undefined) return file;
    const slash = subject.indexOf('/');
    return explainLintRule(subject.slice(0, slash), subject.slice(slash + 1));
}

function explainNamed(session: Session | undefined, subject: string): Explanation | undefined {
    const named = explainSetting(session, subject) ?? explainConfiguration(session, subject);
    if (named !== undefined) return named;
    if (
        !nameListSchema
            .parse(JSON.parse(readFileSync(buildAssetPath(ESLINT_RULE_NAMES_FILE), 'utf8')))
            .names.includes(subject)
    )
        return undefined;
    return explainLintRule(ESLINT_MANIFEST_TOOL, subject);
}

/**
 * Explain a subject, and read the settings of the repository when it has gspot.toml.
 *
 * @param cwd the folder where the command starts.
 * @param subject the check, rule, configuration, setting, or path to explain.
 * @returns the explanation and its command exit code.
 */
async function runExplainCommand(cwd: string, subject: string): Promise<CommandResult> {
    const root = findRoot(cwd);

    const session = findText(root, SETTINGS_FILE) === undefined ? undefined : await openSession(root);

    const result = explain(session, subject);
    return {
        text: result.text,
        json: { ...result.data, kind: result.kind, subject: result.subject },
        exitCode: 0,
    };
}

/**
 * Explain what the subject names.
 *
 * @param session the repository, or undefined outside one.
 * @param subject a check ID, a tool/rule pair, a configuration name, a setting key, or a file path.
 * @returns the explanation.
 * @throws GspotError when no subject or file matches, with the closest known names
 */
function explain(session: Session | undefined, subject: string): Explanation {
    const file = explainPath(session, subject);
    if (file !== undefined && subject.startsWith('./')) return file;
    let explanation: Explanation | undefined;
    if (subject.includes('/')) explanation = explainSlashed(session, subject, file);
    else if (subject.includes('.')) explanation = explainSetting(session, subject);
    else explanation = explainNamed(session, subject);
    if (explanation !== undefined) return explanation;
    if (file !== undefined) return file;
    throw new GspotError('arguments', formatUnknownSubject(session, subject));
}

/**
 * Register the explain command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
 */
export function registerExplain(program: Command, onResult: CommandCompletion): void {
    program
        .command('explain')
        .argument('<subject>', COMMAND_HELP.explain.arguments['subject'])
        .summary(COMMAND_HELP.explain.summary)
        .description(COMMAND_HELP.explain.description)
        .action(async (subject) => {
            onResult(await runExplainCommand(process.cwd(), subject));
        });
}
