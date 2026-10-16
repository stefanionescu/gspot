import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { directoryOf } from '#cli/system/paths.ts';
import { readText } from '#cli/system/file-reads.ts';
import { FILENAME_TAGS } from '#cli/config/repository/inventory.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { ASSET_FOLDER, TEXT_SUFFIXES, GIT_FILE_MODES } from '#cli/config/checks/framework/site.ts';

/**
 * Every selected asset that no local text or tracked outside reference names.
 * @param input the check input.
 * @returns the findings.
 */
export function unusedAssets(input: CheckInput): Finding[] {
    const files = input.files;
    const local = new Set(files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...input.index
            .filter((entry) => entry.stage === 0 && new Set<string | undefined>(GIT_FILE_MODES).has(entry.mode))
            .map((entry) => entry.path),
    ]);
    const texts = paths
        .values()
        .filter((path) => TEXT_SUFFIXES.has(posix.extname(path)))
        .flatMap((path) => {
            const text = readText(input.root, path, input.reads);
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
                    !text.includes(local.has(path) ? name : posix.relative(directoryOf(path), file.path)),
            );
        })
        .map((file) =>
            findingAt(
                input,
                { file: file.path, line: 1 },
                'dead-asset',
                'No page, stylesheet or script names this file.',
            ),
        );
}
