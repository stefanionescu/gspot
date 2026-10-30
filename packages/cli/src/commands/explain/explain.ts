import { find } from '#cli/system/files/reads.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import type { Command } from '@commander-js/extra-typings';
import { explainPath } from '#cli/commands/explain/path.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { listInheritedSettings } from '#cli/settings/inherit.ts';
import { explainSetting } from '#cli/commands/explain/setting.ts';
import type { Explanation } from '#cli/types/commands/explain.ts';
import { ESLINT_BUILTIN_RULES } from '#cli/config/commands/explain.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/configurations/names.ts';
import { explainConfiguration } from '#cli/commands/explain/configuration.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { listCheckIds, readConfigurations } from '#cli/configurations/manifests.ts';
import { explainCheck, explainLintRule, importInstalledTool } from '#cli/commands/explain/check.ts';

function formatUnknownSubject(session: Session | undefined, subject: string): string {
    const subjects = [
        ...listCheckIds(session === undefined ? [] : Object.values(session.settings.commandChecks)),
        ...readConfigurations().keys(),
        ...(session?.scopes.flatMap((scope) =>
            listInheritedSettings(scope.availableSettings, session.settings, scope.path).map((setting) => setting.key),
        ) ?? []),
    ];
    const similar = formatSimilarNames(subject, [...new Set(subjects)]);
    return `There is no check, lint rule, configuration, setting, or file called ${subject}. Give a check (python/ruff), a lint rule (eslint/no-console), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).${similar}`;
}

async function explainSlashed(
    root: string,
    session: Session | undefined,
    { subject, file }: { subject: string; file: Explanation | undefined },
): Promise<Explanation | undefined> {
    const check = explainCheck(session, subject);
    if (check !== undefined) return check;
    if (file !== undefined) return file;
    const slash = subject.indexOf('/');
    return explainLintRule(root, subject.slice(0, slash), subject.slice(slash + 1));
}

async function explainNamed(
    root: string,
    session: Session | undefined,
    subject: string,
): Promise<Explanation | undefined> {
    const named = explainSetting(session, subject) ?? explainConfiguration(session, subject);
    if (named !== undefined) return named;
    if ((await importInstalledTool(root, ESLINT_BUILTIN_RULES)) === undefined) return undefined;
    return explainLintRule(root, ESLINT_MANIFEST_TOOL, subject);
}

async function runExplainCommand(cwd: string, subject: string): Promise<CommandResult> {
    const root = readRepositoryRoot(cwd);

    const session = find(root, SETTINGS_FILE) === undefined ? undefined : await openSession(root);

    const result = await explainSubject(root, session, { subject, cwd });
    return {
        text: result.text,
        json: { ...result.facts, kind: result.kind, subject: result.subject },
        exitCode: 0,
    };
}

async function explainSubject(
    root: string,
    session: Session | undefined,
    { subject, cwd }: { subject: string; cwd: string },
): Promise<Explanation> {
    const file = explainPath(session, subject, cwd);
    if (file !== undefined && (subject.startsWith('./') || subject.startsWith('../'))) return file;
    let explanation: Explanation | undefined;
    if (subject.includes('/')) explanation = await explainSlashed(root, session, { subject, file });
    else if (subject.includes('.')) explanation = explainSetting(session, subject);
    else explanation = await explainNamed(root, session, subject);
    if (explanation !== undefined) return explanation;
    if (file !== undefined) return file;
    throw new GspotError('arguments', formatUnknownSubject(session, subject));
}

/**
Register the explain command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
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
