import { posix } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { FILENAME_TAGS } from '#cli/config/repository/files/classify.ts';
import { SYMLINK_MODE, GIT_FILE_MODES } from '#cli/config/files/modes.ts';

import {
    ASSET_FOLDER,
    TEXT_EXTENSIONS,
    UNUSED_ASSET_RULE,
    CONVENTIONAL_ASSETS,
    UNUSED_ASSET_MESSAGE,
    ASSET_REFERENCE_PREFIX,
    ASSET_REFERENCE_SUFFIX,
} from '#cli/config/checks/framework/site/unused-assets.ts';

/**
Report assets absent from the text files and index. Exclude files that browsers and hosts load by name.

@param session the repository and its tools.
@param planned the scope files and the tracked files.
*/
export function checkSiteUnusedAssets(session: Session, planned: PlannedCheck): CheckFinding[] {
    const local = new Set(planned.files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...session.repository.index
            .filter(
                (indexFile) =>
                    indexFile.stage === 0 &&
                    indexFile.mode !== SYMLINK_MODE &&
                    Object.hasOwn(GIT_FILE_MODES, indexFile.mode),
            )
            .map((indexFile) => indexFile.path),
    ]);
    const texts = paths
        .values()
        .filter((path) => TEXT_EXTENSIONS.has(posix.extname(path)))
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
                !TEXT_EXTENSIONS.has(posix.extname(file.path)) &&
                !CONVENTIONAL_ASSETS.test(file.path),
        )
        .filter((file) => {
            const belowAssets = file.path.slice(
                (ASSET_FOLDER.exec(file.path)?.index ?? 0) + (ASSET_FOLDER.exec(file.path)?.[0].length ?? 0),
            );
            const reference = new RegExp(
                `${ASSET_REFERENCE_PREFIX}/?${RegExp.escape(belowAssets)}${ASSET_REFERENCE_SUFFIX}`,
                'u',
            );
            return !texts.some(
                ({ path, text }) =>
                    reference.test(text) || text.includes(posix.relative(extractParentFolder(path), file.path)),
            );
        })
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: UNUSED_ASSET_RULE,
            message: UNUSED_ASSET_MESSAGE,
        }));
}
