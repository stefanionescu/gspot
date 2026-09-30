import type { CheckSpec } from '#cli/types/kits.ts';
import { scriptInline } from '#cli/checks/bash/inline.ts';
import { scriptPolicy } from '#cli/checks/bash/policy.ts';
import { scriptRemote } from '#cli/checks/bash/remote.ts';
import { scriptSafety } from '#cli/checks/bash/safety.ts';
import { countFindings } from '#cli/checks/bash/counts.ts';
import { docComment } from '#cli/checks/bash/doc-comment.ts';
import { fileLength } from '#cli/checks/bash/file-length.ts';
import { scriptBoundaries } from '#cli/checks/bash/boundaries.ts';
import { scriptIndex } from '#cli/checks/bash/cross-file-index.ts';
import { folderNames } from '#cli/checks/structure/folder-names.ts';
import { scriptInterpreter } from '#cli/checks/bash/interpreter.ts';
import { deadParameters } from '#cli/checks/bash/dead-parameters.ts';
import { functionLength } from '#cli/checks/bash/function-length.ts';
import { envAccessOwner } from '#cli/checks/bash/env-access-owner.ts';
import { trivialFunction } from '#cli/checks/bash/trivial-function.ts';
import { unusedFunctions } from '#cli/checks/bash/unused-functions.ts';
import { duplicateFunctions } from '#cli/checks/bash/duplicate-functions.ts';
import { fileDirectoryCollision } from '#cli/checks/structure/file-layout.ts';
import { prefixCollisions } from '#cli/checks/structure/prefix-collisions.ts';
import { singleFileFolder } from '#cli/checks/structure/single-file-folder.ts';
import { privatePrefix, privateBeforePublic } from '#cli/checks/bash/visibility.ts';
import { scriptSourceOrder, scriptSourceComments } from '#cli/checks/bash/sources.ts';
import { scriptGuards, scriptConfigDefaults } from '#cli/checks/bash/configuration.ts';
import type { Engine, EngineInput, StructureInput, StructureAnalysis } from '#cli/types/checks.ts';
import { SCRIPT_TAG, COUNT_ANALYSES, GSPOT_DIRECTORY, DOCUMENT_EXTENSIONS } from '#cli/config/checks/structure.ts';

// Every size ceiling of a shell script in one pass: file and function lines, then the ast-grep counts.
const bashLimits: StructureAnalysis = async (context, scripts) => {
    const index = await scripts();
    const counted = await Promise.all([...COUNT_ANALYSES].map((analysis) => countFindings(analysis, context, index)));
    return [...(await fileLength(context, scripts)), ...(await functionLength(context, scripts)), ...counted.flat()];
};

const ANALYSES: Record<string, StructureAnalysis> = {
    'single-file-folder': singleFileFolder,
    'prefix-collisions': prefixCollisions,
    'file-directory-collision': fileDirectoryCollision,
    'folder-names': folderNames,
    'bash-limits': bashLimits,
    'doc-comment': docComment,
    'duplicate-functions': duplicateFunctions,
    'unused-functions': unusedFunctions,
    'dead-parameters': deadParameters,
    'private-prefix': privatePrefix,
    'private-before-public': privateBeforePublic,
    'trivial-function': trivialFunction,
    'env-access-owner': envAccessOwner,
    'bash-interpreter': scriptInterpreter,
    'bash-script-policy': scriptPolicy,
    inline: scriptInline,
    remote: scriptRemote,
    'bash-config-defaults': scriptConfigDefaults,
    guards: scriptGuards,
    'bash-boundaries': scriptBoundaries,
    'bash-safety': scriptSafety,
    'source-comments': scriptSourceComments,
    'source-order': scriptSourceOrder,
};
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
 * Resolve the structure analysis while retaining source indexing at execution time.
 * @param spec the check
 * @returns the engine that runs the analysis
 */
export function structureEngine(spec: CheckSpec): Engine {
    const name = spec.analysis ?? '';
    const analysis: StructureAnalysis | undefined = ANALYSES[name];
    if (analysis === undefined) throw new Error(`No structure analysis is called ${name}.`);
    return async (input) => {
        const context = contextFor(input);
        const scriptFiles = context.files.filter((file) => file.tags.includes(SCRIPT_TAG));
        return analysis(context, () => scriptIndex(input, scriptFiles));
    };
}
