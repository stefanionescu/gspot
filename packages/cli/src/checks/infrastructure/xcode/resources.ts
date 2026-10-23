import { posix } from 'node:path';
import { camelCase } from 'scule';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import type { XcodeStrings, AssetContents } from '#cli/types/checks/infrastructure/xcode.ts';
import { stringsFileSchema, assetContentsSchema } from '#cli/schemas/checks/infrastructure/xcode.ts';

import {
    NOT_WORD,
    IMAGE_SET,
    NAMED_SETS,
    ASSET_CONTENTS,
    XCASSETS_FOLDER,
    XCSTRINGS_SUFFIX,
    ASSET_KIND_SUFFIX,
    DEFAULT_SOURCE_LANGUAGE,
    ASSET_REFERENCE_ENDINGS,
} from '#cli/config/checks/infrastructure/xcode/resources.ts';

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
export function checkXcodeXcstrings(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [XCSTRINGS_SUFFIX]).flatMap((path) => {
        const text = readCachedText(session.reads, path);
        const at = { file: path, line: 1 };
        let xcstrings: XcodeStrings;
        try {
            xcstrings = parseJsonFile(path, text, stringsFileSchema);
        } catch (error) {
            if (error instanceof GspotError && error.code === 'filesystem')
                return [buildFinding(planned, at, 'syntax', error.message)];
            throw error;
        }
        const strings = (xcstrings.strings === undefined ? [] : Object.entries(xcstrings.strings)).filter(
            ([, localized]) => localized.shouldTranslate !== false,
        );
        const locales = new Set(
            strings.flatMap(([, localized]) =>
                localized.localizations === undefined ? [] : Object.keys(localized.localizations),
            ),
        );
        locales.delete(xcstrings.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE);
        return strings.flatMap(([key, localized]) => {
            const missing = [...locales].filter((locale) => localized.localizations?.[locale] === undefined);
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
