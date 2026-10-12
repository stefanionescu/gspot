import { z } from 'zod';
import { camelCase } from 'scule';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readSource } from '#cli/system/file-reads.ts';
import { parseJsonDocument } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

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
} from '#cli/config/checks/infrastructure/xcode.ts';

function assetSetName(path: string): string {
    const folder = path.slice(0, path.lastIndexOf('/'));
    const name = posix.basename(folder);
    return name.slice(0, name.lastIndexOf('.'));
}
/** String catalog metadata and translation records. */
const stringsFileSchema = z.object({
    sourceLanguage: z.string().optional(),
    strings: z
        .record(
            z.string(),
            z.object({
                shouldTranslate: z.boolean().optional(),
                localizations: z.record(z.string(), z.unknown()).optional(),
            } satisfies SchemaShape<{
                shouldTranslate?: boolean | undefined;
                localizations?: Record<string, unknown> | undefined;
            }>),
        )
        .optional(),
} satisfies SchemaShape<{
    sourceLanguage?: string | undefined;
    strings?:
        | Record<string, { shouldTranslate?: boolean | undefined; localizations?: Record<string, unknown> | undefined }>
        | undefined;
}>);
/** Image file references consumed from asset catalog contents. */
const assetContentsSchema = z.object({
    images: z
        .array(z.object({ filename: z.string().optional() } satisfies SchemaShape<{ filename?: string | undefined }>))
        .optional(),
} satisfies SchemaShape<{ images?: { filename?: string | undefined }[] | undefined }>);
/**
 * The findings of every asset catalog: each Contents.json parses, each image set holds its images.
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeAssets(input: CheckInput): Finding[] {
    return sourcePaths(input, [ASSET_CONTENTS])
        .filter((path) => path.includes(XCASSETS_FOLDER))
        .flatMap((path) => {
            const read = parseJsonDocument(
                readSource(input.root, path, input.reads).toString('utf8'),
                assetContentsSchema,
            );
            const at = { file: path, line: 1 };
            if ('error' in read) return [findingAt(input, at, 'syntax', read.error)];
            if (!path.endsWith(IMAGE_SET)) return [];
            const contents = read.value;
            const names = (contents.images ?? []).flatMap((image) =>
                image.filename === undefined ? [] : [image.filename],
            );
            if (names.length === 0) return [findingAt(input, at, 'empty-set', 'This image set names no image file.')];
            const folder = path.slice(0, path.lastIndexOf('/'));
            return names
                .filter((name) => statSync(join(input.root, folder, name), { throwIfNoEntry: false }) === undefined)
                .map((name) => findingAt(input, at, 'missing-image', `The image ${name} is not in the set.`));
        });
}
/**
 * Report asset sets that no source or Xcode build setting names.
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeUnusedAssets(input: CheckInput): Finding[] {
    const sourceTexts = sourcePaths(input, ASSET_REFERENCE_ENDINGS).map((path) =>
        readSource(input.root, path, input.reads).toString('utf8'),
    );
    return sourcePaths(input, [ASSET_CONTENTS])
        .filter((path) => NAMED_SETS.some((ending) => path.endsWith(ending)))
        .filter((path) => {
            const name = assetSetName(path);
            const assignment = new RegExp(String.raw`=\s*${RegExp.escape(name)}\s*(?:;|$)`, 'mu');
            return sourceTexts.every(
                (text) =>
                    !text.includes(`"${name}"`) &&
                    !text.includes(`.${camelCase(name.replace(ASSET_KIND_SUFFIX, '').split(NOT_WORD))}`) &&
                    !assignment.test(text),
            );
        })
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'unused-asset',
                `No source names the asset ${assetSetName(path)}.`,
            ),
        );
}
/**
 * The findings of every string catalog: it parses, and every string has every locale the catalog uses.
 * @param input the check input.
 * @returns the findings.
 */
export function xcstrings(input: CheckInput): Finding[] {
    return sourcePaths(input, [XCSTRINGS_SUFFIX]).flatMap((path) => {
        const read = parseJsonDocument(readSource(input.root, path, input.reads).toString('utf8'), stringsFileSchema);
        const at = { file: path, line: 1 };
        if ('error' in read) return [findingAt(input, at, 'syntax', read.error)];
        const strings = read.value;
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
                findingAt(input, at, 'missing-translation', `"${key}" has no translation for ${missing.join(', ')}.`),
            ];
        });
    });
}
