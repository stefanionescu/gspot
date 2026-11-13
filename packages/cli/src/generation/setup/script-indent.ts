import { SCRIPT_EXTENSIONS, TAB_STEP } from '#cli/config/generation/setup.ts';
import { findText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { Repository } from '#cli/types/repository.ts';
import type { TomlTable } from '#cli/types/settings.ts';

export const SCRIPT_FILES = SCRIPT_EXTENSIONS.map((extension) => `**/*${extension}`);

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
export function detectScriptIndent(repository: Repository): TomlTable {
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
