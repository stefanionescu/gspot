import { readSource } from '#cli/repository/tracked.ts';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import type { AssetContents, StringsFile } from '#cli/checks/xcode/types.ts';
import { trackedEnding, xcodeFinding } from '#cli/checks/xcode/files.ts';

const NOT_WORD = /[^A-Za-z\d]/u;
const IMAGE_SET = '.imageset/Contents.json';
const NAMED_SETS = ['.imageset/Contents.json', '.colorset/Contents.json'];

// The parsed JSON of a file, or the parse error under the key error.
function parsed(input: EngineInput, path: string): { value: unknown; error: string | undefined } {
    const text = readSource(input.root, path, input.observations).toString('utf8');
    try {
        return { value: JSON.parse(text) as unknown, error: undefined };
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
        .filter((name) => !(statSync(join(input.root, folder, name), { throwIfNoEntry: false }) !== undefined))
        .map((name) => xcodeFinding(input, at, 'missing-image', `The image ${name} is not in the set.`));
}

function orphanFindings(input: EngineInput, sets: string[]): Finding[] {
    if (input.policyFiles.policy.level !== 'all') return [];
    const swift = trackedEnding(input, ['.swift', '.storyboard', '.xib', '.plist']).map((path) =>
        readSource(input.root, path, input.observations).toString('utf8'),
    );
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
export function stringFiles(input: EngineInput): Finding[] {
    return trackedEnding(input, ['.xcstrings']).flatMap((path) => stringFindings(input, path));
}

/**
 * The findings of every asset catalog: each Contents.json parses, each image set holds its images, and code names each asset.
 * @param input the engine input
 * @returns the findings
 */
export function assetFolders(input: EngineInput): Finding[] {
    const contents = trackedEnding(input, ['Contents.json']).filter((path) => path.includes('.xcassets/'));
    return [...contents.flatMap((path) => imageFindings(input, path)), ...orphanFindings(input, contents)];
}
