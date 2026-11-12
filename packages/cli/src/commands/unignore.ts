import {
    buildUnchangedResult,
    formatIgnoreSubject,
    readIgnoreEditContext,
    writeSettingsEdit,
} from '#cli/commands/edits.ts';
import {
    BARE_UNIGNORE_MESSAGE,
    ESCAPED_GLOB_CHARACTERS,
    NO_CHECK_IGNORE_TEXTS,
    RULE_WITHOUT_CHECK_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { PATHS_OPTION, RULE_OPTION } from '#cli/config/commands/help.ts';
import { assertCheckExists } from '#cli/manifests/read.ts';
import { removeRecordPaths } from '#cli/settings/edit.ts';
import { buildArgumentPaths } from '#cli/settings/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { formatCount, formatNameList, quoteArgument } from '#cli/system/text.ts';
import type {
    CommandDefinition,
    IgnoreFlags,
    IgnoreOptions,
    IgnoreRemoval,
    IgnoreTarget,
} from '#cli/types/commands/edits.ts';
import type { IgnoreRecord, TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';

function removeIgnores(table: TomlTable, options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreRemoval {
    const { check, rule, paths } = options;
    const ignores = (table['ignore'] as IgnoreRecord[] | undefined) ?? [];
    const matching = new Set(
        ignores.filter((ignore) => ignore.check === check && (rule === undefined || ignore.rule === rule)),
    );
    const kept = ignores.flatMap((ignore) => {
        if (!matching.has(ignore)) return [ignore];
        if (paths === undefined) return [];
        return removeRecordPaths(
            [ignore],
            paths,
            (recordPath, path) =>
                recordPath.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1') === path.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1'),
        ) as IgnoreRecord[];
    });
    const changed = kept.filter((ignore) => !ignores.includes(ignore));
    const narrowed = ignores.filter((ignore) => matching.has(ignore) && !kept.includes(ignore));
    const everyPath = [...matching].filter((ignore) => ignore.paths === undefined);
    return {
        kept,
        deleted: ignores.length - kept.length,
        changedIgnores: changed.length,
        removedPaths:
            narrowed.flatMap((ignore) => ignore.paths ?? []).length -
            changed.flatMap((ignore) => ignore.paths ?? []).length,
        everywhere: paths === undefined ? [] : everyPath,
    };
}

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
    const context = await readIgnoreEditContext(options.root);
    const { edit: input, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(input.table, {
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
    if (kept.length === 0) delete input.table['ignore'];
    else input.table['ignore'] = kept;
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
