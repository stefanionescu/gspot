import { camelCase } from 'scule';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { parseJsonDocument } from '#cli/parsers/json.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { trackedByExtension } from '#cli/checks/tool/xcode/project.ts';
import { NOT_WORD, IMAGE_SET, NAMED_SETS } from '#cli/config/checks/tool/xcode.ts';
import { stringsFileSchema, assetContentsSchema } from '#cli/parsers/schema/xcode.ts';

function assetSetName(path: string): string {
    const folder = path.slice(0, path.lastIndexOf('/'));
    const name = posix.basename(folder);
    return name.slice(0, name.lastIndexOf('.'));
}

/**
 * The findings of every asset catalog: each Contents.json parses, each image set holds its images.
 * @param input the check input
 * @returns the findings
 */
export function contentsFindings(input: CheckInput): Finding[] {
    return trackedByExtension(input, ['Contents.json'])
        .filter((path) => path.includes('.xcassets/'))
        .flatMap((path) => {
            const read = parseJsonDocument(
                readSource(input.root, path, input.reads).toString('utf8'),
                assetContentsSchema,
            );
            const at = { file: path, line: 1 };
            if (read.error !== undefined) return [findingAt(input, at, 'syntax', read.error)];
            if (!path.endsWith(IMAGE_SET)) return [];
            const contents = read.data;
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
 * @param input the check input
 * @returns the findings
 */
export function orphanAssets(input: CheckInput): Finding[] {
    const sourceTexts = trackedByExtension(input, [
        '.swift',
        '.storyboard',
        '.xib',
        '.plist',
        'project.pbxproj',
        '.xcconfig',
    ]).map((path) => readSource(input.root, path, input.reads).toString('utf8'));
    return trackedByExtension(input, ['Contents.json'])
        .filter((path) => NAMED_SETS.some((ending) => path.endsWith(ending)))
        .filter((path) => {
            const name = assetSetName(path);
            const assignment = new RegExp(String.raw`=\s*${RegExp.escape(name)}\s*(?:;|$)`, 'mu');
            return sourceTexts.every(
                (text) =>
                    !text.includes(`"${name}"`) &&
                    !text.includes(`.${camelCase(name.split(NOT_WORD))}`) &&
                    !assignment.test(text),
            );
        })
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'orphan-asset',
                `No source names the asset ${assetSetName(path)}.`,
            ),
        );
}

/**
 * The findings of every string catalog: it parses, and every string has every locale the catalog uses.
 * @param input the check input
 * @returns the findings
 */
export function xcstrings(input: CheckInput): Finding[] {
    return trackedByExtension(input, ['.xcstrings']).flatMap((path) => {
        const read = parseJsonDocument(readSource(input.root, path, input.reads).toString('utf8'), stringsFileSchema);
        const at = { file: path, line: 1 };
        if (read.error !== undefined) return [findingAt(input, at, 'syntax', read.error)];
        const strings = read.data;
        const entries = (strings.strings === undefined ? [] : Object.entries(strings.strings)).filter(
            ([, entry]) => entry.shouldTranslate !== false,
        );
        const locales = new Set(
            entries.flatMap(([, entry]) => (entry.localizations === undefined ? [] : Object.keys(entry.localizations))),
        );
        locales.delete(strings.sourceLanguage ?? 'en');
        return entries.flatMap(([key, entry]) => {
            const missing = [...locales].filter((locale) => entry.localizations?.[locale] === undefined);
            if (missing.length === 0) return [];
            return [
                findingAt(input, at, 'missing-translation', `"${key}" has no translation for ${missing.join(', ')}.`),
            ];
        });
    });
}
