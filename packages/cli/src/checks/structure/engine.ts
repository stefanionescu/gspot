import type { CheckSpec } from '#cli/types/configurations.ts';
import { countFindings } from '#cli/checks/structure/counts.ts';
import { docComment } from '#cli/checks/structure/doc-comment.ts';
import { folderNames } from '#cli/checks/structure/folder-names.ts';
import type { Engine, EngineInput } from '#cli/types/checks/checks.ts';
import { scriptEmbeds } from '#cli/checks/structure/scripts/embeds.ts';
import { scriptPolicy } from '#cli/checks/structure/scripts/policy.ts';
import { scriptSafety } from '#cli/checks/structure/scripts/safety.ts';
import { DOCUMENT_EXTENSIONS } from '#cli/checks/structure/patterns.ts';
import { scriptIndex } from '#cli/checks/structure/cross-file-index.ts';
import { deadParameters } from '#cli/checks/structure/dead-parameters.ts';
import { functionLength } from '#cli/checks/structure/function-length.ts';
import { envAccessOwner } from '#cli/checks/structure/env-access-owner.ts';
import { trivialFunction } from '#cli/checks/structure/trivial-function.ts';
import { unusedFunctions } from '#cli/checks/structure/unused-functions.ts';
import { prefixCollisions } from '#cli/checks/structure/prefix-collisions.ts';
import { scriptSshBlocks } from '#cli/checks/structure/scripts/ssh-blocks.ts';
import { scriptBoundaries } from '#cli/checks/structure/scripts/boundaries.ts';
import { singleFileFolder } from '#cli/checks/structure/single-file-folder.ts';
import { scriptInterpreter } from '#cli/checks/structure/scripts/interpreter.ts';
import { duplicateFunctions } from '#cli/checks/structure/duplicate-functions.ts';
import { privateBeforePublic, privatePrefix } from '#cli/checks/structure/visibility.ts';
import type { StructureAnalysis, StructureContext } from '#cli/types/checks/structure.ts';
import { fileDirectoryCollision, fileLength } from '#cli/checks/structure/file-layout.ts';
import { scriptConfigDefaults, scriptConfigGuards } from '#cli/checks/structure/scripts/configuration.ts';

const ANALYSES: Record<string, StructureAnalysis> = {
    'single-file-folder': singleFileFolder,
    'prefix-collisions': prefixCollisions,
    'file-directory-collision': fileDirectoryCollision,
    'folder-names': folderNames,
    'file-length': fileLength,
    'function-length': functionLength,
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
    'bash-embeds': scriptEmbeds,
    'bash-ssh-blocks': scriptSshBlocks,
    'bash-config-defaults': scriptConfigDefaults,
    'bash-config-guards': scriptConfigGuards,
    'bash-boundaries': scriptBoundaries,
    'bash-safety': scriptSafety,
};
const COUNT_ANALYSES = new Set(['bash-branches', 'bash-nesting', 'bash-mutable-assignments']);
const SCRIPT_TAG = 'shell';
const GSPOT_DIRECTORY = '.gspot/';

function contextFor(input: EngineInput): StructureContext {
    const files = input.files.filter(
        (file) =>
            file.nature === 'source' &&
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
        report: (file, line, rule, text) => ({
            check: input.spec.name,
            file,
            line,
            rule,
            message: text,
            fixable: false,
        }),
    };
}

/**
 * Resolve the structure analysis while retaining source indexing at execution time.
 * @param spec the check
 * @returns the engine that runs the analysis
 */
export function resolveStructure(spec: CheckSpec): Engine {
    const name = spec.analysis ?? '';
    const analysis: StructureAnalysis | undefined = COUNT_ANALYSES.has(name)
        ? async (context, scripts) => countFindings(name, context, await scripts())
        : ANALYSES[name];
    if (analysis === undefined) throw new Error(`No structure analysis is called ${name}.`);
    return async (input) => {
        const context = contextFor(input);
        const scriptFiles = context.files.filter((file) => file.tags.includes(SCRIPT_TAG));
        return analysis(context, () => scriptIndex(input, scriptFiles));
    };
}
