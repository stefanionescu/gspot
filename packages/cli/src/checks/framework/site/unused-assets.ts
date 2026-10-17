import { posix } from 'node:path';
import { buildFinding } from '#cli/checks/finding.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { FILENAME_TAGS } from '#cli/config/repository/inventory.ts';
import { REGULAR_FILE_MODES } from '#cli/config/repository/revisions.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { ASSET_FOLDER, TEXT_SUFFIXES } from '#cli/config/checks/framework/site.ts';

/**
 * Reports each asset that no text file in the scope or the index names.
 * @param input the scope files and the tracked files.
 * @returns the findings.
 */
export function checkSiteUnusedAssets(input: CheckInput): Finding[] {
    const files = input.files;
    const local = new Set(files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...input.index
            .filter((entry) => entry.stage === 0 && REGULAR_FILE_MODES.has(entry.mode))
            .map((entry) => entry.path),
    ]);
    const texts = paths
        .values()
        .filter((path) => TEXT_SUFFIXES.has(posix.extname(path)))
        .flatMap((path) => {
            const text = readCachedText(input.reads, path);
            return text === undefined ? [] : [{ path, text }];
        })
        .toArray();
    return files
        .filter(
            (file) =>
                ASSET_FOLDER.test(file.path) &&
                !Object.hasOwn(FILENAME_TAGS, posix.basename(file.path)) &&
                !TEXT_SUFFIXES.has(posix.extname(file.path)),
        )
        .filter((file) => {
            const name = posix.basename(file.path);
            return texts.every(
                ({ path, text }) =>
                    !text.includes(local.has(path) ? name : posix.relative(extractParentFolder(path), file.path)),
            );
        })
        .map((file) =>
            buildFinding(
                input,
                { file: file.path, line: 1 },
                'dead-asset',
                'No page, stylesheet or script names this file.',
            ),
        );
}
