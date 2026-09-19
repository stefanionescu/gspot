// The string files and the asset folders of a project: every string has every locale, and every image set has an image that exists and that code names.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { AssetContents, StringsFile } from '#types/apple.ts';
import { textOf, trackedEnding, xcodeFinding } from '#cli/apple/xcode/files.ts';

const NOT_WORD = /[^A-Za-z\d]/u;
const IMAGE_SET = '.imageset/Contents.json';
const NAMED_SETS = ['.imageset/Contents.json', '.colorset/Contents.json'];

// The parsed JSON of a file, or the parse error under the key error.
function parsed(input: EngineInput, path: string): { value: unknown; error: string | undefined } {
    try {
        return { value: JSON.parse(textOf(input, path)) as unknown, error: undefined };
    } catch (error) {
        return { value: undefined, error: error instanceof Error ? error.message : 'The file is not JSON.' };
    }
}

function stringFindings(input: EngineInput, path: string): Finding[] {
    const read = parsed(input, path);
    const at = { file: path, line: 1 };
    if (read.error !== undefined) return [xcodeFinding(input, at, 'parse', read.error)];
    const strings = read.value as StringsFile;
    const entries = Object.entries(strings.strings ?? {}).filter(([, entry]) => entry.shouldTranslate !== false);
    const locales = new Set(entries.flatMap(([, entry]) => Object.keys(entry.localizations ?? {})));
    locales.delete(strings.sourceLanguage ?? 'en');
    return entries.flatMap(([key, entry]) => {
        const missing = [...locales].filter((locale) => entry.localizations?.[locale] === undefined);
        if (missing.length === 0) return [];
        return [
            xcodeFinding(input, at, 'missing-translation', `"${key}" has no translation for ${missing.join(', ')}.`),
        ];
    });
}

function setName(path: string): string {
    const folder = path.slice(0, path.lastIndexOf('/'));
    const name = folder.slice(folder.lastIndexOf('/') + 1);
    return name.slice(0, name.lastIndexOf('.'));
}

// The symbol Xcode writes for an asset: the name in lower camel case, with the separators gone.
function symbolOf(name: string): string {
    const words = name.split(NOT_WORD).filter((word) => word !== '');
    const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    return joined.charAt(0).toLowerCase() + joined.slice(1);
}

function imageFindings(input: EngineInput, path: string): Finding[] {
    const read = parsed(input, path);
    const at = { file: path, line: 1 };
    if (read.error !== undefined) return [xcodeFinding(input, at, 'parse', read.error)];
    if (!path.endsWith(IMAGE_SET)) return [];
    const contents = read.value as AssetContents;
    const names = (contents.images ?? []).flatMap((image) => (image.filename === undefined ? [] : [image.filename]));
    if (names.length === 0) return [xcodeFinding(input, at, 'empty-set', 'This image set names no image file.')];
    const folder = path.slice(0, path.lastIndexOf('/'));
    return names
        .filter((name) => !existsSync(join(input.root, folder, name)))
        .map((name) => xcodeFinding(input, at, 'missing-image', `The image ${name} is not in the set.`));
}

function orphanFindings(input: EngineInput, sets: string[]): Finding[] {
    if (input.view.tool('xcode')['orphan_assets'] === false) return [];
    const swift = trackedEnding(input, ['.swift', '.storyboard', '.xib', '.plist']).map((path) => textOf(input, path));
    return sets
        .filter((path) => NAMED_SETS.some((ending) => path.endsWith(ending)))
        .filter((path) => {
            const name = setName(path);
            return swift.every((text) => !text.includes(`"${name}"`) && !text.includes(`.${symbolOf(name)}`));
        })
        .map((path) =>
            xcodeFinding(input, { file: path, line: 1 }, 'orphan-asset', `No source names the asset ${setName(path)}.`),
        );
}

/**
 * The findings of every string catalog: it parses, and every string has every locale the catalog uses.
 * @param input the engine input
 * @returns the findings
 */
export function stringFiles(input: EngineInput): Promise<Finding[]> {
    return Promise.resolve(trackedEnding(input, ['.xcstrings']).flatMap((path) => stringFindings(input, path)));
}

/**
 * The findings of every asset catalog: each Contents.json parses, each image set holds its images, and code names each asset.
 * @param input the engine input
 * @returns the findings
 */
export function assetFolders(input: EngineInput): Promise<Finding[]> {
    const contents = trackedEnding(input, ['Contents.json']).filter((path) => path.includes('.xcassets/'));
    return Promise.resolve([
        ...contents.flatMap((path) => imageFindings(input, path)),
        ...orphanFindings(input, contents),
    ]);
}
