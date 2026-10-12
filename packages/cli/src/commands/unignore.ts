import { GspotError } from '#cli/errors.ts';
import { compact, isRecord } from '#cli/objects.ts';
import { printResult } from '#cli/terminal/print.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { counted } from '#cli/terminal/check-report.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { knownChecks } from '#cli/configurations/manifests.ts';
import { unknownCheckMessage } from '#cli/configurations/unknown-names.ts';
import { saveSettings, startSettingsEdit } from '#cli/commands/save-settings.ts';
import type { IgnoreOptions, IgnoreRemoval } from '#cli/types/commands/save-settings.ts';

/**
 * Register removal of ignores by check, lint rule, and path.
 * @param program the command program
 */
function registerUnignore(program: Command): void {
    program
        .command('unignore')
        .argument('<check>', COMMAND_HELP.unignore.arguments['check'])
        .summary(COMMAND_HELP.unignore.summary)
        .description(COMMAND_HELP.unignore.description)
        .option('--rule <rule>', COMMAND_HELP.unignore.options['--rule <rule>'])
        .option('--paths <glob...>', COMMAND_HELP.unignore.options['--paths <glob...>'])
        .action(async (check, flags) => {
            printResult(await unignoreCommand({ cwd: process.cwd(), check, ...flags }));
        });
}

// Calculate matching record and path removals without changing the captured settings.
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
        const record = entry as Record<string, unknown>;
        if (removed.size === 0) {
            deleted += 1;
            return [];
        }
        if (record['paths'] === undefined) {
            everywhere += 1;
            return [entry];
        }
        if (!Array.isArray(record['paths'])) return [entry];
        const paths = record['paths'].filter((path) => !removed.has(String(path)));
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
 * Remove matching ignores or paths while preserving unmatched records.
 * @param options the repository, check, optional rule, and paths
 * @returns the mutation result and any ignore that still covers every path
 */
async function unignoreCommand(
    options: Pick<IgnoreOptions, 'cwd' | 'check' | 'rule' | 'paths'>,
): Promise<CommandResult> {
    const { root, input } = await startSettingsEdit(options.cwd);
    const commandChecks: unknown[] = Array.isArray(input.table['command_check']) ? input.table['command_check'] : [];
    const names = commandChecks.flatMap((entry) =>
        isRecord(entry) && typeof entry['name'] === 'string' ? [{ name: entry['name'] }] : [],
    );
    const known = knownChecks(names);
    if (!known.includes(options.check)) throw new GspotError('arguments', [unknownCheckMessage(options.check, known)]);
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(input.table, options);
    const [noun, verb, pronoun] = everywhere === 1 ? ['ignore', 'covers', 'it'] : ['ignores', 'cover', 'them'];
    const warning =
        everywhere === 0
            ? ''
            : `Kept ${String(everywhere)} ${noun} that ${verb} every path. To delete ${pronoun}, run gspot unignore without --paths.\n`;
    const warningFields = compact({ warning: everywhere === 0 ? undefined : warning.trim() });
    if (deleted === 0 && changedIgnores === 0) {
        parseSettings(input.text, root);
        return {
            text: `nothing to remove\n${warning}`,
            json: { changed: false, ...warningFields },
            exitCode: 0,
        };
    }
    const summary = [
        { count: deleted, message: `deleted ${counted(deleted, 'ignore')}` },
        {
            count: changedIgnores,
            message: `took ${counted(removedPaths, 'path')} out of ${counted(changedIgnores, 'ignore')}`,
        },
    ]
        .filter(({ count }) => count !== 0)
        .map(({ message }) => message)
        .join('\n');
    const result = await saveSettings(root, {
        input,
        summary,
        change: (written) => {
            if (kept.length === 0) Reflect.deleteProperty(written, 'ignore');
            else written['ignore'] = kept;
        },
    });
    return { ...result, text: result.text + warning, json: { ...result.json, ...warningFields } };
}

export { registerUnignore };
