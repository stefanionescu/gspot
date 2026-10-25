import { posix } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { FILENAME_TAGS } from '#cli/config/repository/files/classify.ts';
import { ASSET_FOLDER, TEXT_SUFFIXES, REGULAR_FILE_MODES } from '#cli/config/checks/framework/site/unused-assets.ts';

/**
Reports each asset that no text file in the scope or the index names.

@param session the repository and its tools.
@param planned the scope files and the tracked files.
@returns the findings.
*/
export function checkSiteUnusedAssets(session: Session, planned: PlannedCheck): Finding[] {
    const local = new Set(planned.files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...session.repository.index
            .filter((indexFile) => indexFile.stage === 0 && REGULAR_FILE_MODES.has(indexFile.mode))
            .map((indexFile) => indexFile.path),
    ]);
    const texts = paths
        .values()
        .filter((path) => TEXT_SUFFIXES.has(posix.extname(path)))
        .map((path) => {
            const text = findCachedText(session.reads, path);
            return text === undefined ? undefined : { path, text };
        })
        .filter((source) => source !== undefined)
        .toArray();
    return planned.files
        .filter(
            (file) =>
                ASSET_FOLDER.test(file.path) &&
                !FILENAME_TAGS.has(posix.basename(file.path)) &&
                !TEXT_SUFFIXES.has(posix.extname(file.path)),
        )
        .filter((file) => {
            const name = posix.basename(file.path);
            return !texts.some(({ path, text }) =>
                text.includes(local.has(path) ? name : posix.relative(extractParentFolder(path), file.path)),
            );
        })
        .map((file) =>
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'unused-asset',
                'No page, stylesheet or script names this file.',
            ),
        );
}
