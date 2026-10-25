import { posix } from 'node:path';
import { camelCase } from 'scule';
import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCheckedFile } from '#cli/checks/syntax.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { PBXPROJ, SWIFT_EXTENSION } from '#cli/config/files/names.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects/dependencies.ts';
import { isInFolders, parseProjectSources } from '#cli/parsers/projects/xcode.ts';
import { stringsFileSchema, assetContentsSchema } from '#cli/schemas/checks/infrastructure/xcode.ts';

import {
    NOT_WORD,
    PLIST_KEY,
    IMAGE_SET,
    NAMED_SETS,
    PLIST_SUFFIX,
    ASSET_CONTENTS,
    XCASSETS_FOLDER,
    XCSTRINGS_SUFFIX,
    ASSET_KIND_SUFFIX,
    ENTITLEMENTS_SUFFIX,
    DEFAULT_SOURCE_LANGUAGE,
    ASSET_REFERENCE_ENDINGS,
    INSECURE_TRANSPORT_SETTING,
} from '#cli/config/checks/infrastructure/xcode.ts';

/**
Reports Swift sources that no Xcode target holds.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkXcodeFilesWithoutTarget(session: Session, planned: PlannedCheck): Finding[] {
    const projects = listSourcePaths(planned.files, [PBXPROJ]).map((path) =>
        parseProjectSources(readCachedText(session.reads, path), path),
    );
    if (projects.length === 0) return [];
    const referenced = new Set(projects.flatMap((project) => [...project.sources]));
    const folders = projects.flatMap((project) => project.folders);
    const swiftFiles = listSourcePaths(planned.files, [SWIFT_EXTENSION]).filter(
        (file) => posix.basename(file) !== PACKAGE_SWIFT,
    );
    return swiftFiles
        .filter((file) => !referenced.has(file) && !isInFolders(file, folders))
        .map((file) =>
            buildFinding(planned, { file, line: 1 }, 'untargeted', 'This Swift file is in no target of the project.'),
        );
}

function getAssetSetName(path: string): string {
    const folder = extractParentFolder(path);
    const name = posix.basename(folder);
    return name.slice(0, name.lastIndexOf('.'));
}
/**
Checks that each asset catalog Contents.json parses and each image set holds its images.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkXcodeAssets(session: Session, planned: PlannedCheck): Finding[] {
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => path.includes(XCASSETS_FOLDER))
        .flatMap((path) => {
            const text = readCachedText(session.reads, path);
            const at = { file: path, line: 1 };
            const parsed = parseCheckedFile(planned, path, () => parseJsonFile(path, text, assetContentsSchema));
            if ('error' in parsed) return [parsed.error];
            if (!path.endsWith(IMAGE_SET)) return [];
            const names = (parsed.value.images ?? []).flatMap((image) =>
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
Reports asset sets that no source or Xcode build setting names.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
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
            return !sourceTexts.some(
                (text) =>
                    text.includes(`"${name}"`) ||
                    text.includes(`.${camelCase(name.replace(ASSET_KIND_SUFFIX, '').split(NOT_WORD))}`) ||
                    assignment.test(text),
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
Checks that each string catalog parses and that every string has every locale the catalog uses.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkXcodeXcstrings(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [XCSTRINGS_SUFFIX]).flatMap((path) => {
        const text = readCachedText(session.reads, path);
        const at = { file: path, line: 1 };
        const parsed = parseCheckedFile(planned, path, () => parseJsonFile(path, text, stringsFileSchema));
        if ('error' in parsed) return [parsed.error];
        const strings = (parsed.value.strings === undefined ? [] : Object.entries(parsed.value.strings)).filter(
            ([, localized]) => localized.shouldTranslate !== false,
        );
        const locales = new Set(
            strings.flatMap(([, localized]) =>
                localized.localizations === undefined ? [] : Object.keys(localized.localizations),
            ),
        );
        locales.delete(parsed.value.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE);
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

/**
Reports each entitlement that xcode.allowed_entitlements does not list.

@param session the repository and its tools.
@param planned the scope files and allowed entitlements.
@returns the findings.
*/
export function checkXcodeEntitlements(session: Session, planned: PlannedCheck): Finding[] {
    const allowed = new Set(getTable(planned.scope.settings, 'xcode').allowed_entitlements);
    return listSourcePaths(planned.files, [ENTITLEMENTS_SUFFIX]).flatMap((path) => {
        const text = readCachedText(session.reads, path);
        return text
            .matchAll(PLIST_KEY)
            .filter((match) => !allowed.has(match.groups?.['name'] ?? ''))
            .map((match) => {
                const line = getPosition(text, match.index).line;
                return buildFinding(
                    planned,
                    { file: path, line },
                    'entitlement',
                    `${match.groups?.['name'] ?? ''} is not an allowed entitlement.`,
                );
            })
            .toArray();
    });
}

/**
Reports each plist that turns App Transport Security off for every host.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkXcodeAppTransportSecurity(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [PLIST_SUFFIX]).flatMap((path): Finding[] => {
        const text = readCachedText(session.reads, path);
        const found = INSECURE_TRANSPORT_SETTING.exec(text);
        if (found === null) return [];
        const line = getPosition(text, found.index).line;
        return [
            buildFinding(
                planned,
                { file: path, line },
                'arbitrary-loads',
                'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.',
            ),
        ];
    });
}
