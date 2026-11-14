import { GspotError } from '#cli/system/errors.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { removeIgnores } from '#cli/settings/toml/edit.ts';
import type { IgnoreRecord } from '#cli/types/settings.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import { assertCheckExists } from '#cli/manifests/checks.ts';
import { buildArgumentPaths } from '#cli/settings/values/paths.ts';
import { RULE_OPTION, PATHS_OPTION } from '#cli/config/commands/help.ts';
import { formatCount, formatNameList } from '#cli/system/text/messages.ts';
import type { IgnoreFlags, IgnoreTarget, IgnoreOptions, CommandDefinition } from '#cli/types/commands.ts';
import { readEditContext, writeSettingsEdit, formatIgnoreSubject, buildUnchangedResult } from '#cli/commands/edits.ts';

import {
    BARE_UNIGNORE_MESSAGE,
    NO_CHECK_IGNORE_TEXTS,
    RULE_WITHOUT_CHECK_MESSAGE,
} from '#cli/config/commands/edits.ts';

function formatIgnoreTarget(options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreTarget {
    if (options.check === undefined) return NO_CHECK_IGNORE_TEXTS;
    const subject = formatIgnoreSubject(options.check, options.rule);
    const paths = options.paths === undefined ? '' : ` for ${formatNameList(options.paths)}`;
    return { unmatched: `${subject} has no matching ignore`, removed: `of ${subject}${paths}` };
}

function listEverywhereNotes(check: string | undefined, everywhere: IgnoreRecord[]): string[] {
    if (check === undefined) return [];
    return [...new Set(everywhere.map(({ rule }) => rule))].map((rule) => {
        const ruleFlag = rule === undefined ? '' : ` --rule ${quoteArgument(rule)}`;
        return `The ignore of ${formatIgnoreSubject(check, rule)} covers every path, so --paths removes nothing from it. Run gspot unignore ${quoteArgument(check)}${ruleFlag} to remove it.`;
    });
}

async function runUnignoreCommand(options: Omit<IgnoreOptions, 'reason'>): Promise<CommandResult> {
    const context = await readEditContext(options.root);
    const { file, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(file.table, {
        ...options,
        paths: buildArgumentPaths(context.root, options.cwd, options.paths),
    });
    const notes = listEverywhereNotes(options.check, everywhere);
    const target = formatIgnoreTarget(options);
    if (deleted + changedIgnores === 0)
        return buildUnchangedResult(
            notes.length === 0 ? `No change: ${target.unmatched}.` : `No change. ${notes.join(' ')}`,
        );
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
    if (kept.length === 0) delete file.table['ignore'];
    else file.table['ignore'] = kept;
    return await writeSettingsEdit(context, { summary, notes });
}

export const UNIGNORE_COMMAND: CommandDefinition<
    [string | undefined],
    Partial<IgnoreFlags>,
    Omit<IgnoreOptions, 'root' | 'reason'>
> = {
    name: 'unignore',
    arguments: [{ term: '[check]' }],
    options: [{ flags: RULE_OPTION }, { flags: PATHS_OPTION, repeats: true }],
    parse: ({ arguments: commandArguments, flags: { rule, paths }, cwd }) => {
        const [check] = commandArguments;
        if (check === undefined && rule !== undefined) throw new GspotError('arguments', RULE_WITHOUT_CHECK_MESSAGE);
        if (check === undefined && paths === undefined) throw new GspotError('arguments', BARE_UNIGNORE_MESSAGE);
        return { cwd, check, rule, paths };
    },
    run: runUnignoreCommand,
};
