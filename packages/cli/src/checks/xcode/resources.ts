import { posix } from 'node:path';
import { camelCase } from 'scule';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { XcodeStrings, AssetContents } from '#cli/types/checks/xcode.ts';
import { stringsFileSchema, assetContentsSchema } from '#cli/schemas/checks/xcode.ts';

import {
    NOT_WORD,
    IMAGE_SET,
    NAMED_SETS,
    ASSET_CONTENTS,
    XCASSETS_FOLDER,
    XCSTRINGS_SUFFIX,
    ASSET_KIND_SUFFIX,
    ASSET_REFERENCE_ENDINGS,
    DEFAULT_SOURCE_LANGUAGE,
} from '#cli/config/checks/xcode.ts';

function getAssetSetName(path: string): string {
    const folder = extractParentFolder(path);
    const name = posix.basename(folder);
    return name.slice(0, name.lastIndexOf('.'));
}
/**
 * Checks that each asset catalog Contents.json parses and each image set holds its images.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkXcodeAssets(session: Session, planned: PlannedCheck): Finding[] {
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => path.includes(XCASSETS_FOLDER))
        .flatMap((path) => {
            const text = readCachedText(session.reads, path);
            const at = { file: path, line: 1 };
            let contents: AssetContents;
            try {
                contents = parseJsonFile(path, text, assetContentsSchema);
            } catch (error) {
                if (error instanceof GspotError && error.code === 'filesystem')
                    return [buildFinding(planned, at, 'syntax', error.message)];
                throw error;
            }
            if (!path.endsWith(IMAGE_SET)) return [];
            const names = (contents.images ?? []).flatMap((image) =>
                image.filename === undefined ? [] : [image.filename],
            );
            if (names.length === 0)
                return [buildFinding(planned, at, 'empty-set', 'This image set names no image file.')];
            const folder = extractParentFolder(path);
            return names
                .filter((name) => !repositoryPaths.has(posix.join(folder, name)))
                .map((name) => buildFinding(planned, at, 'missing-image', `The image ${name} is not in the set.`));
        });
}

/**
 * Reports asset sets that no source or Xcode build setting names.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkXcodeUnusedAssets(session: Session, planned: PlannedCheck): Finding[] {
    const sourceTexts = listSourcePaths(planned.files, ASSET_REFERENCE_ENDINGS).map((path) =>
        readCachedText(session.reads, path),
    );
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => NAMED_SETS.some((ending) => path.endsWith(ending)))
        .filter((path) => {
            const name = getAssetSetName(path);
            const assignment = new RegExp(String.raw`=\s*${RegExp.escape(name)}\s*(?:;|$)`, 'mu');
            return sourceTexts.every(
                (text) =>
                    !text.includes(`"${name}"`) &&
                    !text.includes(`.${camelCase(name.replace(ASSET_KIND_SUFFIX, '').split(NOT_WORD))}`) &&
                    !assignment.test(text),
            );
        })
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'unused-asset',
                `No source names the asset ${getAssetSetName(path)}.`,
            ),
        );
}

/**
 * Checks that each string catalog parses and that every string has every locale the catalog uses.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkXcstrings(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [XCSTRINGS_SUFFIX]).flatMap((path) => {
        const text = readCachedText(session.reads, path);
        const at = { file: path, line: 1 };
        let strings: XcodeStrings;
        try {
            strings = parseJsonFile(path, text, stringsFileSchema);
        } catch (error) {
            if (error instanceof GspotError && error.code === 'filesystem')
                return [buildFinding(planned, at, 'syntax', error.message)];
            throw error;
        }
        const entries = (strings.strings === undefined ? [] : Object.entries(strings.strings)).filter(
            ([, entry]) => entry.shouldTranslate !== false,
        );
        const locales = new Set(
            entries.flatMap(([, entry]) => (entry.localizations === undefined ? [] : Object.keys(entry.localizations))),
        );
        locales.delete(strings.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE);
        return entries.flatMap(([key, entry]) => {
            const missing = [...locales].filter((locale) => entry.localizations?.[locale] === undefined);
            if (missing.length === 0) return [];
            return [
                buildFinding(
                    planned,
                    at,
                    'missing-translation',
                    `"${key}" has no translation for ${missing.join(', ')}.`,
                ),
            ];
        });
    });
}
