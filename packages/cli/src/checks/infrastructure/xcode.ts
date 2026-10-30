import { posix } from 'node:path';
import { camelCase } from 'scule';
import { read } from '#cli/system/files/reads.ts';
import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects.ts';
import { parseProjectSources } from '#cli/parsers/projects/xcode.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { parseCheckedFile } from '#cli/checks/cross-configuration/syntax.ts';
import { PBXPROJ_SUFFIX, SWIFT_EXTENSION } from '#cli/config/files/names.ts';
import { stringsFileSchema, assetContentsSchema } from '#cli/schemas/checks/infrastructure.ts';

import {
    PLIST_KEY,
    IMAGE_SET,
    NAMED_SETS,
    XCODE_RULES,
    PLIST_SUFFIX,
    WORD_SEPARATOR,
    ASSET_CONTENTS,
    XCASSETS_FOLDER,
    XCSTRINGS_SUFFIX,
    EMPTY_SET_MESSAGE,
    ASSET_KIND_SUFFIX,
    ENTITLEMENTS_SUFFIX,
    UNTARGETED_FILE_MESSAGE,
    DEFAULT_SOURCE_LANGUAGE,
    ASSET_REFERENCE_ENDINGS,
    INSECURE_TRANSPORT_MESSAGE,
    INSECURE_TRANSPORT_SETTING,
} from '#cli/config/checks/infrastructure.ts';

/**
Reports Swift sources that no Xcode target holds.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkFilesWithoutTarget(session: Session, planned: PlannedCheck): CheckFinding[] {
    const projects = listSourcePaths(planned.files, [PBXPROJ_SUFFIX]).map((path) =>
        parseProjectSources(read(session.cache, path), path),
    );
    if (projects.length === 0) return [];
    const referenced = new Set(projects.flatMap((project) => [...project.sources]));
    const folders = projects.flatMap((project) => project.folders);
    const swiftFiles = listSourcePaths(planned.files, [SWIFT_EXTENSION]).filter(
        (file) => posix.basename(file) !== PACKAGE_SWIFT,
    );
    return swiftFiles
        .filter(
            (file) =>
                !referenced.has(file) &&
                !folders.some(({ path, excluded }) => file.startsWith(path) && !excluded.has(file)),
        )
        .map((file) => ({
            file,
            line: 1,
            rule: XCODE_RULES.untargeted,
            message: UNTARGETED_FILE_MESSAGE,
        }));
}

function extractAssetSetName(path: string): string {
    const folder = extractParentFolder(path);
    const name = posix.basename(folder);
    return name.slice(0, name.lastIndexOf('.'));
}

/**
Checks that each asset catalog Contents.json parses and each image set holds its images.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkAssets(session: Session, planned: PlannedCheck): CheckFinding[] {
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => path.includes(XCASSETS_FOLDER))
        .flatMap((path) => {
            const text = read(session.cache, path);
            const at = { file: path, line: 1 };
            const parsed = parseCheckedFile(path, () => parseJsonFile(path, text, assetContentsSchema));
            if ('error' in parsed) return [parsed.error];
            if (!path.endsWith(IMAGE_SET)) return [];
            const names = (parsed.value.images ?? []).flatMap((image) =>
                image.filename === undefined ? [] : [image.filename],
            );
            if (names.length === 0)
                return [
                    {
                        ...at,
                        rule: XCODE_RULES.emptySet,
                        message: EMPTY_SET_MESSAGE,
                    },
                ];
            const folder = extractParentFolder(path);
            return names
                .filter((name) => !repositoryPaths.has(posix.join(folder, name)))
                .map((name) => ({
                    ...at,
                    rule: XCODE_RULES.missingImage,
                    message: `The image ${name} is not in the set.`,
                }));
        });
}

/**
Reports asset sets that no source or Xcode build setting names.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkXcodeUnusedAssets(session: Session, planned: PlannedCheck): CheckFinding[] {
    const sourceTexts = listSourcePaths(planned.files, ASSET_REFERENCE_ENDINGS).map((path) =>
        read(session.cache, path),
    );
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => NAMED_SETS.some((ending) => path.endsWith(ending)))
        .filter((path) => {
            const name = extractAssetSetName(path);
            const assignment = new RegExp(String.raw`=\s*${RegExp.escape(name)}\s*(?:;|$)`, 'mu');
            return !sourceTexts.some(
                (text) =>
                    text.includes(`"${name}"`) ||
                    text.includes(`<string>${name}</string>`) ||
                    text.includes(`.${camelCase(name.replace(ASSET_KIND_SUFFIX, '').split(WORD_SEPARATOR))}`) ||
                    assignment.test(text),
            );
        })
        .map((path) => ({
            file: path,
            line: 1,
            rule: XCODE_RULES.unusedAsset,
            message: `No source names the asset ${extractAssetSetName(path)}.`,
        }));
}

/**
Checks that each string catalog parses and that every string has every locale the catalog uses.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkXcstrings(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [XCSTRINGS_SUFFIX]).flatMap((path) => {
        const text = read(session.cache, path);
        const at = { file: path, line: 1 };
        const parsed = parseCheckedFile(path, () => parseJsonFile(path, text, stringsFileSchema));
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
                {
                    ...at,
                    rule: XCODE_RULES.missingTranslation,
                    message: `"${key}" has no translation for ${missing.join(', ')}.`,
                },
            ];
        });
    });
}

/**
Reports each entitlement that xcode.allowed_entitlements does not list.

@param session the repository and its tools.
@param planned the scope files and allowed entitlements.
*/
export function checkEntitlements(session: Session, planned: PlannedCheck): CheckFinding[] {
    const allowed = new Set(getTable(planned.scope.settings, 'xcode').allowed_entitlements);
    return listSourcePaths(planned.files, [ENTITLEMENTS_SUFFIX]).flatMap((path) => {
        const text = read(session.cache, path);
        return text
            .matchAll(PLIST_KEY)
            .filter((match) => !allowed.has(match.groups?.['name'] ?? ''))
            .map((match) => {
                const line = getPosition(text, match.index).line;
                return {
                    file: path,
                    line,
                    rule: XCODE_RULES.entitlement,
                    message: `${match.groups?.['name'] ?? ''} is not an allowed entitlement.`,
                };
            })
            .toArray();
    });
}

/**
Reports each plist that turns App Transport Security off for every host.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkAppTransportSecurity(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [PLIST_SUFFIX]).flatMap((path): CheckFinding[] => {
        const text = read(session.cache, path);
        const found = INSECURE_TRANSPORT_SETTING.exec(text);
        if (found === null) return [];
        const line = getPosition(text, found.index).line;
        return [
            {
                file: path,
                line,
                rule: XCODE_RULES.arbitraryLoads,
                message: INSECURE_TRANSPORT_MESSAGE,
            },
        ];
    });
}
