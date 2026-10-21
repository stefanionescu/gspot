import { formatCount } from '#cli/system/text.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { isRecord, stripUndefined } from '#cli/system/tables.ts';
import type { IgnoreOptions } from '#cli/types/commands/ignore.ts';
import { assertKnownCheck } from '#cli/configurations/manifests.ts';
import type { IgnoreRemoval } from '#cli/types/commands/unignore.ts';
import type { TomlTable, IgnoreRecord } from '#cli/types/settings/file.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { applySettingsEdit, prepareSettingsEdit } from '#cli/apply/settings-edit.ts';

// Find the records and paths to remove, and leave the read settings unchanged.
function removeIgnores(written: TomlTable, options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreRemoval {
    const removed = new Set(options.paths);
    const ignores: unknown[] = Array.isArray(written['ignore']) ? written['ignore'] : [];
    const entries = ignores.map((entry) => ({
        entry,
        matching:
            isRecord(entry) &&
            entry['check'] === options.check &&
            (options.rule === undefined || entry['rule'] === options.rule),
    }));
    let deleted = 0;
    let changedIgnores = 0;
    let removedPaths = 0;
    let everywhere = 0;
    const kept = entries.flatMap(({ entry, matching }) => {
        if (!matching) return [entry];
        const record = entry as IgnoreRecord;
        if (removed.size === 0) {
            deleted += 1;
            return [];
        }
        if (record['paths'] === undefined) {
            everywhere += 1;
            return [entry];
        }
        const paths = record['paths'].filter((path) => !removed.has(path));
        if (paths.length === record['paths'].length) return [entry];
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

/**
 * Remove the matching ignores or paths, and keep the other records.
 *
 * @param options the check, the lint rule, and the paths to match.
 * @returns the edit result, and any ignore that still covers every path.
 */
async function runUnignoreCommand(
    options: Pick<IgnoreOptions, 'cwd' | 'check' | 'rule' | 'paths'>,
): Promise<CommandResult> {
    const { root, input, settings } = prepareSettingsEdit(options.cwd);
    if (options.check !== undefined) assertKnownCheck(options.check, settings);
    const target = options.check ?? 'every check';
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(input.table, options);
    const [verb, pronoun] = everywhere === 1 ? ['covers', 'it'] : ['cover', 'them'];
    const warning =
        everywhere === 0
            ? ''
            : `Kept ${formatCount(everywhere, 'ignore')} that ${verb} every path. To delete ${pronoun}, run gspot unignore without --paths.\n`;
    const warningFields = stripUndefined({ warning: everywhere === 0 ? undefined : warning.trim() });
    if (deleted + changedIgnores === 0) {
        return {
            text: `No change: ${target} has no matching ignore.\n${warning}`,
            json: { changed: false, ...warningFields },
            exitCode: 0,
        };
    }
    const summary = [
        { count: deleted, message: `Removed ${formatCount(deleted, 'ignore')} for ${target}.` },
        {
            count: changedIgnores,
            message: `Removed ${formatCount(removedPaths, 'path')} from ${formatCount(changedIgnores, 'ignore')}.`,
        },
    ]
        .filter(({ count }) => count !== 0)
        .map(({ message }) => message)
        .join('\n');
    if (kept.length === 0) Reflect.deleteProperty(input.table, 'ignore');
    else input.table['ignore'] = kept;
    const result = await applySettingsEdit(root, { edit: input, summary });
    return { ...result, text: result.text + warning, json: { ...result.json, ...warningFields } };
}

/**
 * Register the unignore command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
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
