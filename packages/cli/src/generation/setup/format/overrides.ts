import {
    FORMATTER_DEFAULTS,
    PYTHON_TAG,
    RUFF_SETTINGS_FILES,
    SCRIPT_EXTENSIONS,
    SCRIPT_FILES,
    TAB_STEP,
    UNREADABLE_CONFIG_MESSAGE,
} from '#cli/config/generation/setup.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { readEditorconfig } from '#cli/generation/setup/format/editorconfig.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { ruffOptionsSchema, ruffProjectSchema } from '#cli/schemas/generation.ts';
import { findText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { RuffOptions } from '#cli/types/generation.ts';
import type { Repository } from '#cli/types/repository.ts';
import type { TomlTable } from '#cli/types/settings.ts';

function convertRuffFormat(options: RuffOptions): TomlTable {
    const fields = {
        indent_style: options.format?.['indent-style'],
        indent_width: options['indent-width'],
        print_width: options['line-length'],
        quotes: options.format?.['quote-style'],
    };
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function keepDiffering(
    paths: readonly string[],
    format: TomlTable,
    { fields, trackedPaths }: { fields: TomlTable; trackedPaths: readonly string[] },
): TomlTable[] {
    const differing = Object.entries(format).filter(([key, value]) => fields[key] !== value);
    const tracked = paths.filter((glob) => trackedPaths.some(buildPathMatcher([glob])));
    return differing.length === 0 || tracked.length === 0 ? [] : [{ paths: tracked, ...Object.fromEntries(differing) }];
}

function listIndentSteps(text: string): string[] {
    let previousWidth = 0;
    return text.split('\n').flatMap((line) => {
        const indent = line.slice(0, line.length - line.trimStart().length);
        if (indent.length === line.length) return [];
        if (indent.includes('\t')) return [TAB_STEP];
        const step = indent.length - previousWidth;
        previousWidth = indent.length;
        return step > 0 ? [String(step)] : [];
    });
}

/**
Find the indent that most lines of the .sh and .bash files use. init records it once, because reading it on each run
makes a new script change a generated file.
*/
function detectScriptIndent(repository: Repository): TomlTable {
    const steps = repository.files
        .filter((file) => file.kind === 'source' && SCRIPT_EXTENSIONS.includes(extractExtension(file.path)))
        .flatMap((file) => listIndentSteps(findText(repository.root, file.path) ?? ''));
    const [step] =
        [...Map.groupBy(steps, (each) => each)].toSorted(
            ([firstStep, firstLines], [secondStep, secondLines]) =>
                secondLines.length - firstLines.length || compareText(firstStep, secondStep),
        )[0] ?? [];
    if (step === undefined) return {};
    return step === TAB_STEP ? { indent_style: 'tab' } : { indent_style: 'space', indent_width: Number(step) };
}

export function readRuffOptions(root: string): { path: string; options: RuffOptions } | undefined {
    for (const path of RUFF_SETTINGS_FILES) {
        const text = findText(root, path);
        if (text === undefined) continue;
        const read = tryParseFile(() =>
            path === PYPROJECT_TOML
                ? parseTomlFile(path, text, ruffProjectSchema)
                : { tool: { ruff: parseTomlFile(path, text, ruffOptionsSchema) } },
        );
        if (read === undefined) return { path, options: { dropped: [UNREADABLE_CONFIG_MESSAGE] } };
        if (read.tool?.ruff !== undefined) return { path, options: read.tool.ruff };
    }
    return undefined;
}

export function buildFormatterOverrides(
    fields: TomlTable,
    repository: Repository,
    trackedPaths: readonly string[],
): TomlTable[] {
    const tags = new Set(repository.files.filter((file) => file.kind === 'source').flatMap((file) => file.tags));
    const ruff = readRuffOptions(repository.root)?.options;
    const printWidth = readEditorconfig(repository.root)?.printWidth;
    const written = printWidth === undefined ? {} : { print_width: printWidth };
    return [
        ...FORMATTER_DEFAULTS.filter(({ tag }) => tags.has(tag)).flatMap(({ tag, paths, format }) => {
            const carried = tag === PYTHON_TAG && ruff !== undefined ? convertRuffFormat(ruff) : {};
            return keepDiffering(paths, { ...format, ...written, ...carried }, { fields, trackedPaths });
        }),
        ...keepDiffering(SCRIPT_FILES, detectScriptIndent(repository), { fields, trackedPaths }),
    ];
}
