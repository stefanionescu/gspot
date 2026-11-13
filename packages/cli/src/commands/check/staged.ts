import { runTreeCheck } from '#cli/commands/check/tree.ts';
import { NOTHING_STAGED_MESSAGE, STAGE_SETUP_MESSAGE, UNSTAGED_TOOLS_NOTE } from '#cli/config/commands/check.ts';
import { TOOL_PROJECT_FILES } from '#cli/config/generation/files.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { buildEmptyRunReport } from '#cli/engine/run/report.ts';
import { readTreeStatus } from '#cli/repository/revisions/changes.ts';
import { listUnstagedSetupPaths, writeIndexTree } from '#cli/repository/revisions/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { formatNameList, formatNameState } from '#cli/system/text/messages.ts';
import type { CheckCommandJson, CheckOptions } from '#cli/types/commands.ts';
import type { CommandResult } from '#cli/types/system.ts';

async function assertSetupStaged(root: string, cancelSignal: AbortSignal): Promise<void> {
    const unstaged = await listUnstagedSetupPaths(root, cancelSignal);
    if (unstaged.length > 0)
        throw new GspotError('git', `${formatNameState(unstaged, 'not staged')}. ${STAGE_SETUP_MESSAGE}`);
}

export async function runStagedCheck(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
    const started = new Date();
    await assertSetupStaged(root, cancelSignal);
    const status = await readTreeStatus(root, cancelSignal);
    if (!status.hasStagedChanges) {
        const json = buildEmptyRunReport(options.stage ?? 'all', started, [NOTHING_STAGED_MESSAGE]);
        return { text: `${NOTHING_STAGED_MESSAGE}\n`, json, exitCode: 0 };
    }
    const { staged: stagedPaths, unstaged, untracked } = status;
    const unstagedPaths = new Set(unstaged);
    const selection = {
        content: 'index',
        paths: stagedPaths,
        unstagedChanges: stagedPaths.filter((path) => unstagedPaths.has(path)).length,
    } as const;
    // The disk holds the staged bytes, so checks run in place, unless gspot.toml has edits that the commit leaves out.
    if (selection.unstagedChanges === 0 && !unstagedPaths.has(SETTINGS_FILE))
        return await runTreeCheck(root, options, cancelSignal, {
            session: { toolsRoot: root, untracked: { paths: [], unreadablePaths: untracked.unreadablePaths } },
            started,
            selection: { ...selection, reference: await writeIndexTree(root, cancelSignal) },
        });
    using copy = await copyRevision(root, { kind: 'index', paths: stagedPaths }, cancelSignal);
    // The tools on disk follow the tool files on disk, and the copy asks for the tools of the staged settings.
    const toolFiles = TOOL_PROJECT_FILES.filter((path) => unstagedPaths.has(path));
    const changed = `${formatNameList(toolFiles)} ${toolFiles.length === 1 ? 'has' : 'have'}`;
    return await runTreeCheck(copy.root, options, cancelSignal, {
        session: { toolsRoot: root, unreadablePaths: copy.unreadablePaths },
        started,
        selection: { ...selection, reference: copy.tree },
        ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
        ...(toolFiles.length > 0 && { missingToolsNote: UNSTAGED_TOOLS_NOTE.replace('<files>', () => changed) }),
    });
}
