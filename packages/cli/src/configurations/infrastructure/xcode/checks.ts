import { posix } from 'node:path';

import { camelCase } from 'scule';

import {
    ASSET_CONTENTS,
    ASSET_KIND_SUFFIX,
    ASSET_REFERENCE_ENDINGS,
    DEFAULT_SOURCE_LANGUAGE,
    EMPTY_SET_MESSAGE,
    ENTITLEMENTS_SUFFIX,
    IMAGE_SET,
    INSECURE_TRANSPORT_MESSAGE,
    INSECURE_TRANSPORT_SETTING,
    LINT_SCRIPT,
    NAMED_SETS,
    PLIST_KEY,
    PLIST_SUFFIX,
    UNTARGETED_FILE_MESSAGE,
    WORD_SEPARATOR,
    XCASSETS_FOLDER,
    XCODE_RULES,
    XCSTRINGS_SUFFIX,
} from '#cli/config/configurations/infrastructure.ts';
import { PACKAGE_SWIFT, PBXPROJ_SUFFIX, SWIFT_EXTENSION } from '#cli/config/parsers.ts';
import {
    ASSET_EXPLANATIONS,
    BUILD_SETTING_EXPLANATIONS,
    XCSTRINGS_EXPLANATIONS,
} from '#cli/configurations/infrastructure/xcode/explanations.ts';
import { parseCheckedFile } from '#cli/configurations/syntax.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseBuildTargets, parseProjectSources } from '#cli/parsers/projects/xcode.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { assetContentsSchema, stringsFileSchema } from '#cli/schemas/configurations.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { escapeRegExp, getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

function extractAssetSetName(path: string): string {
    const folder = extractParentFolder(path);
    const name = posix.basename(folder);
    return name.slice(0, name.lastIndexOf('.'));
}

function checkFilesWithoutTarget(session: Session, planned: PlannedCheck): CheckFinding[] {
    const projects = listSourcePaths(planned.files, [PBXPROJ_SUFFIX]).map((path) =>
        parseProjectSources(readText(session.cache, path), path),
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
                folders.every(({ path, excluded }) => !file.startsWith(path) || excluded.has(file)),
        )
        .map((file) => ({
            file,
            line: 1,
            rule: XCODE_RULES.untargeted,
            message: UNTARGETED_FILE_MESSAGE,
        }));
}

function checkAssets(session: Session, planned: PlannedCheck): CheckFinding[] {
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => path.includes(XCASSETS_FOLDER))
        .flatMap((path) => {
            const text = readText(session.cache, path);
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

function checkXcodeUnusedAssets(session: Session, planned: PlannedCheck): CheckFinding[] {
    const sourceTexts = listSourcePaths(planned.files, ASSET_REFERENCE_ENDINGS).map((path) =>
        readText(session.cache, path),
    );
    return listSourcePaths(planned.files, [ASSET_CONTENTS])
        .filter((path) => NAMED_SETS.some((ending) => path.endsWith(ending)))
        .filter((path) => {
            const name = extractAssetSetName(path);
            const assignment = new RegExp(String.raw`=\s*${escapeRegExp(name)}\s*(?:;|$)`, 'mu');
            return sourceTexts.every(
                (text) =>
                    !(
                        text.includes(`"${name}"`) ||
                        text.includes(`<string>${name}</string>`) ||
                        text.includes(`.${camelCase(name.replace(ASSET_KIND_SUFFIX, '').split(WORD_SEPARATOR))}`) ||
                        assignment.test(text)
                    ),
            );
        })
        .map((path) => ({
            file: path,
            line: 1,
            rule: XCODE_RULES.unusedAsset,
            message: `No source names the asset ${extractAssetSetName(path)}.`,
        }));
}

function checkXcstrings(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [XCSTRINGS_SUFFIX]).flatMap((path) => {
        const text = readText(session.cache, path);
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

function checkEntitlements(session: Session, planned: PlannedCheck): CheckFinding[] {
    const allowed = new Set(getTable(planned.scope.settings, 'xcode').allowed_entitlements);
    return listSourcePaths(planned.files, [ENTITLEMENTS_SUFFIX]).flatMap((path) => {
        const text = readText(session.cache, path);
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

function checkAppTransportSecurity(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [PLIST_SUFFIX]).flatMap((path): CheckFinding[] => {
        const text = readText(session.cache, path);
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

function checkBuildSettings(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [PBXPROJ_SUFFIX]).flatMap((path) => {
        const parsed = parseCheckedFile(path, () => parseBuildTargets(readText(session.cache, path), path));
        if ('error' in parsed) return [parsed.error];
        return parsed.value.flatMap((target) =>
            [
                {
                    isFound: !target.isStrict,
                    rule: XCODE_RULES.strictConcurrency,
                    message: `Target ${target.name} does not set SWIFT_STRICT_CONCURRENCY = complete or Swift 6.`,
                },
                ...target.scripts.flatMap(({ name, script, hasFiles }) => [
                    {
                        isFound: !hasFiles,
                        rule: XCODE_RULES.undeclaredScript,
                        message: `Run-script phase ${name} of ${target.name} declares no input or output files.`,
                    },
                    {
                        isFound: LINT_SCRIPT.test(script),
                        rule: XCODE_RULES.lintScript,
                        message: `Run-script phase ${name} of ${target.name} runs the linter. gspot runs it at commit.`,
                    },
                ]),
            ]
                .filter(({ isFound }) => isFound)
                .map(({ rule, message }) => ({ file: path, line: 1, rule, message })),
        );
    });
}

export const XCODE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'xcode/app-transport-security': { check: checkAppTransportSecurity },
    'xcode/assets': { check: checkAssets, explanations: ASSET_EXPLANATIONS },
    'xcode/build-settings': { check: checkBuildSettings, explanations: BUILD_SETTING_EXPLANATIONS },
    'xcode/entitlements': { check: checkEntitlements },
    'xcode/files-without-target': { check: checkFilesWithoutTarget },
    'xcode/unused-assets': { check: checkXcodeUnusedAssets },
    'xcode/xcstrings': { check: checkXcstrings, explanations: XCSTRINGS_EXPLANATIONS },
};
