import {
    buildIgnorePaths,
    buildUnchangedResult,
    pathsOption,
    readIgnoreEditContext,
    writeSettingsEdit,
} from '#cli/commands/edits.ts';
import {
    BARE_UNIGNORE_MESSAGE,
    ESCAPED_GLOB_CHARACTERS,
    NO_CHECK_IGNORE_TEXTS,
    RULE_WITHOUT_CHECK_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { RULE_OPTION } from '#cli/config/commands/help.ts';
import { assertCheckExists } from '#cli/manifests/read.ts';
import { removeRecordPaths } from '#cli/settings/edit.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isTable } from '#cli/system/tables.ts';
import { formatCount, formatNameList } from '#cli/system/text.ts';
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
            paths === undefined
                ? 0
                : [...matching].filter((ignore) => (ignore as IgnoreRecord).paths === undefined).length,
    };
}

function formatIgnoreTarget(options: Pick<IgnoreOptions, 'check' | 'rule' | 'paths'>): IgnoreTarget {
    if (options.check === undefined) return NO_CHECK_IGNORE_TEXTS;
    const subject = options.rule === undefined ? options.check : `rule ${options.rule} of ${options.check}`;
    const paths = options.paths === undefined ? '' : ` for ${formatNameList(options.paths)}`;
    return { unmatched: `${subject} has no matching ignore`, removed: `for ${subject}${paths}` };
}

async function runUnignoreCommand(
    options: Pick<IgnoreOptions, 'root' | 'cwd' | 'check' | 'rule' | 'paths'>,
): Promise<CommandResult> {
    const context = await readIgnoreEditContext(options.root);
    const { root, edit: input, settings } = context;
    if (options.check !== undefined) assertCheckExists(options.check, Object.values(settings.commandChecks));
    const { kept, deleted, changedIgnores, removedPaths, everywhere } = removeIgnores(input.table, {
        ...options,
        paths: buildIgnorePaths(context, options.cwd, options.paths),
    });
    const notes =
        everywhere > 0 && options.check !== undefined
            ? [
                  `The ignore of ${options.check} covers every path, so --paths removes nothing from it. Run gspot unignore ${options.check} to remove it.`,
              ]
            : [];
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

export const UNIGNORE_COMMAND: CommandDefinition<[string | undefined], Partial<IgnoreFlags>> = {
    name: 'unignore',
    arguments: [{ term: '[check]' }],
    options: [{ flags: RULE_OPTION }, pathsOption],
    run: async ({ arguments: commandArguments, flags: { rule, paths }, root, cwd }) => {
        const [check] = commandArguments;
        if (check === undefined && rule !== undefined) throw new GspotError('arguments', RULE_WITHOUT_CHECK_MESSAGE);
        if (check === undefined && paths === undefined) throw new GspotError('arguments', BARE_UNIGNORE_MESSAGE);
        return await runUnignoreCommand({ root, cwd, check, rule, paths });
    },
};
