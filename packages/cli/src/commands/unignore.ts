import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isEveryPath } from '#cli/settings/scopes.ts';
import { removeRecordPaths } from '#cli/settings/edit.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { RULE_OPTION } from '#cli/config/commands/help.ts';
import { assertCheckExists } from '#cli/manifests/read.ts';
import { formatCount, formatNameList } from '#cli/system/text.ts';
import type { TomlTable, IgnoreRecord } from '#cli/types/settings.ts';

import {
    NO_CHECK_IGNORE_TEXTS,
    ESCAPED_GLOB_CHARACTERS,
    RULE_WITHOUT_CHECK_MESSAGE,
} from '#cli/config/commands/edits.ts';
import type {
    IgnoreFlags,
    IgnoreTarget,
    IgnoreOptions,
    IgnoreRemoval,
    CommandDefinition,
} from '#cli/types/commands/edits.ts';
import {
    pathsOption,
    buildIgnorePaths,
    writeSettingsEdit,
    buildUnchangedResult,
    readSettingsEditContext,
} from '#cli/commands/edits.ts';

function removeIgnores(table: TomlTable, options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreRemoval {
    const { check, rule, paths } = options;
    const ignores: unknown[] = Array.isArray(table['ignore']) ? table['ignore'] : [];
    const matching = new Set(
        ignores.filter(
            (ignore) => isTable(ignore) && ignore['check'] === check && (rule === undefined || ignore['rule'] === rule),
        ),
    );
    const kept = ignores.flatMap((ignore) => {
        if (!matching.has(ignore)) return [ignore];
        if (paths === undefined) return [];
        return removeRecordPaths(
            [ignore],
            paths,
            (recordPath, path) =>
                recordPath.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1') === path.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1'),
        );
    });
    const changed = kept.filter((ignore) => !ignores.includes(ignore)) as IgnoreRecord[];
    const narrowed = ignores.filter((ignore) => matching.has(ignore) && !kept.includes(ignore)) as IgnoreRecord[];
    return {
        kept,
        deleted: ignores.length - kept.length,
        changedIgnores: changed.length,
        removedPaths:
            narrowed.flatMap((ignore) => ignore.paths ?? []).length -
            changed.flatMap((ignore) => ignore.paths ?? []).length,
        everywhere:
            paths === undefined ? 0 : [...matching].filter((ignore) => isEveryPath(ignore as IgnoreRecord)).length,
    };
}

function formatIgnoreTarget(options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreTarget {
    if (options.check === undefined) return NO_CHECK_IGNORE_TEXTS;
    const subject = options.rule === undefined ? options.check : `rule ${options.rule} of ${options.check}`;
    const paths = options.paths === undefined ? '' : ` for ${formatNameList(options.paths)}`;
    return { unmatched: `${subject} has no matching ignore`, removed: `for ${subject}${paths}` };
}

function formatEverywhereNote(everywhere: number, check: string | undefined): string[] {
    if (everywhere === 0) return [];
    const subject = check ?? 'every check';
    const command = check === undefined ? 'gspot unignore' : 'gspot unignore ' + check;
    return [
        `The ignore of ${subject} covers every path, so --paths removes nothing from it. Run ${command} to remove it.`,
    ];
}

async function runUnignoreCommand(
    options: Pick<IgnoreOptions, 'root' | 'cwd' | 'check' | 'rule' | 'paths'>,
): Promise<CommandResult> {
    const context = await readSettingsEditContext(options.root);
    const { root, edit: input, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(input.table, {
        ...options,
        paths: buildIgnorePaths(context, options.cwd, options.paths),
    });
    const notes = formatEverywhereNote(everywhere, options.check);
    const target = formatIgnoreTarget(options);
    if (deleted + changedIgnores === 0)
        return buildUnchangedResult(
            notes.length === 0 ? `No change: ${target.unmatched}.` : `No change: ${notes.join(' ')}`,
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
    return await writeSettingsEdit(root, {
        cache: context.cache,
        listing: context.listing,
        edit: input,
        summary,
        notes,
    });
}

export const unignoreCommand: CommandDefinition<[string | undefined], Partial<IgnoreFlags>> = {
    name: 'unignore',
    arguments: [{ term: '[check]' }],
    options: [{ flags: RULE_OPTION }, pathsOption],
    run: async ([check], { rule, paths }, { root, cwd }) => {
        if (check === undefined && rule !== undefined) throw new GspotError('arguments', RULE_WITHOUT_CHECK_MESSAGE);
        return await runUnignoreCommand({ root, cwd, check, rule, paths });
    },
};
