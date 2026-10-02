// What every structure analysis reads: the source files without documents or generated output, and the Bash settings.
import { SCRIPT_TAG } from '#cli/config/checks/general/general.ts';
import { scriptIndex } from '#cli/checks/language/bash/scripts.ts';
import type { Engine, EngineInput } from '#cli/types/execution/execution.ts';
import type { StructureInput, StructureAnalysis } from '#cli/types/checks/checks.ts';
import { GSPOT_DIRECTORY, DOCUMENT_EXTENSIONS } from '#cli/config/checks/general/structure.ts';

function contextFor(input: EngineInput): StructureInput {
    const files = input.files.filter(
        (file) =>
            file.kind === 'source' &&
            DOCUMENT_EXTENSIONS.every((extension) => !file.path.endsWith(extension)) &&
            !file.path.startsWith(GSPOT_DIRECTORY),
    );
    const bash = input.view.tool('bash');
    return {
        input,
        files,
        limit: input.view.limit,
        bashText: (slot, otherwise) => (typeof bash[slot] === 'string' ? bash[slot] : otherwise),
        bashList: (slot) => (Array.isArray(bash[slot]) ? (bash[slot] as string[]) : []),
        bashSetting: (slot) => bash[slot],
    };
}

/**
 * The engine of one structure analysis: it builds the context and the index of the shell scripts when the analysis asks.
 * @param analysis the analysis
 * @returns the engine that runs it
 */
export function structureEngine(analysis: StructureAnalysis): Engine {
    return async (input) => {
        const context = contextFor(input);
        const scriptFiles = context.files.filter((file) => file.tags.includes(SCRIPT_TAG));
        return analysis(context, () => scriptIndex(input, scriptFiles));
    };
}
