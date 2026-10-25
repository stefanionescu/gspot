import { formatCount } from '#cli/system/text.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { assertCheckExists } from '#cli/configurations/manifests.ts';
import type { TomlTable, IgnoreRecord } from '#cli/types/settings/file.ts';
import type { IgnoreTarget, IgnoreRemoval } from '#cli/types/commands/unignore.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { applySettingsEdit, prepareSettingsEdit } from '#cli/generation/settings-edit.ts';
import { NO_CHECK_IGNORE_TEXTS, ESCAPED_GLOB_CHARACTERS } from '#cli/config/commands/unignore.ts';

function removeIgnores(written: TomlTable, options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreRemoval {
    const removed = new Set(options.paths?.map((path) => path.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1')));
    const ignores: unknown[] = Array.isArray(written['ignore']) ? written['ignore'] : [];
    let deleted = 0;
    let changedIgnores = 0;
    let removedPaths = 0;
    let everywhere = 0;
    const matching = new Set(
        ignores.filter(
            (ignore) =>
                isTable(ignore) &&
                ignore['check'] === options.check &&
                (options.rule === undefined || ignore['rule'] === options.rule),
        ),
    );
    const kept = ignores.flatMap((ignore): unknown[] => {
        if (!matching.has(ignore)) return [ignore];
        if (removed.size === 0) {
            deleted += 1;
            return [];
        }
        const record = ignore as IgnoreRecord;
        if (record['paths'] === undefined) {
            everywhere += 1;
            return [ignore];
        }
        const paths = record['paths'].filter((path) => !removed.has(path.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1')));
        if (paths.length === record['paths'].length) return [ignore];
        if (paths.length === 0) {
            deleted += 1;
            return [];
        }
        changedIgnores += 1;
        removedPaths += record['paths'].length - paths.length;
        return [{ ...record, paths }];
    });
    return { kept, deleted, changedIgnores, removedPaths, everywhere };
}

function formatIgnoreTarget(options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreTarget {
    if (options.check === undefined) return NO_CHECK_IGNORE_TEXTS;
    const subject = options.rule === undefined ? options.check : `rule ${options.rule} of ${options.check}`;
    const paths = options.paths === undefined ? '' : ` for ${options.paths.join(' and ')}`;
    return { noMatch: `${subject} has no matching ignore`, removed: `for ${subject}${paths}` };
}

async function runUnignoreCommand(
    options: Pick<IgnoreOptions, 'cwd' | 'check' | 'rule' | 'paths'>,
): Promise<CommandResult> {
    const { root, input, settings } = prepareSettingsEdit(options.cwd);
    if (options.check !== undefined) assertCheckExists(options.check, settings);
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(input.table, options);
    const [verb, pronoun] = everywhere === 1 ? ['covers', 'it'] : ['cover', 'them'];
    const warning =
        everywhere === 0
            ? ''
            : `Kept ${formatCount(everywhere, 'ignore')} that ${verb} every path. To delete ${pronoun}, run gspot unignore without --paths.\n`;
    const warningFields = stripUndefined({ warning: everywhere === 0 ? undefined : warning.trim() });
    const target = formatIgnoreTarget(options);
    if (deleted + changedIgnores === 0) {
        return {
            text: `No change: ${target.noMatch}.\n${warning}`,
            json: { changed: false, ...warningFields },
            exitCode: 0,
        };
    }
    const summary = [
        {
            count: deleted,
            message: `Removed ${formatCount(deleted, 'ignore')} ${target.removed}.`,
        },
        {
            count: changedIgnores,
            message: `Removed ${formatCount(removedPaths, 'path')} from ${formatCount(changedIgnores, 'ignore')} ${target.removed}.`,
        },
    ]
        .filter(({ count }) => count !== 0)
        .map(({ message }) => message)
        .join(' ');
    if (kept.length === 0) Reflect.deleteProperty(input.table, 'ignore');
    else input.table['ignore'] = kept;
    const result = await applySettingsEdit(root, {
        edit: input,
        summary: summary + (warning === '' ? '' : '\n' + warning.trimEnd()),
    });
    return { ...result, json: { ...result.json, ...warningFields } };
}

/**
Register the unignore command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerUnignore(program: Command, onResult: CommandCompletion): void {
    program
        .command('unignore')
        .argument('[check]', COMMAND_HELP.unignore.arguments['check'])
        .summary(COMMAND_HELP.unignore.summary)
        .description(COMMAND_HELP.unignore.description)
        .option('--rule <rule>', COMMAND_HELP.unignore.options['--rule <rule>'])
        .option('--paths <path...>', COMMAND_HELP.unignore.options['--paths <path...>'])
        .action(async (check, flags) => {
            onResult(
                await runUnignoreCommand({
                    cwd: process.cwd(),
                    ...stripUndefined({ check, rule: flags.rule, paths: flags.paths }),
                }),
            );
        });
}
