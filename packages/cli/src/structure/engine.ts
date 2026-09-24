import type { Engine, EngineInput } from '#cli/types/execution.ts';
// The structure engine: one analysis per check, chosen by `analysis =` in the manifest.
import type { CheckSpec } from '#cli/types/configurations.ts';
import { countFindings } from '#cli/structure/counts.ts';
import { DOCUMENT_EXTENSIONS } from '#cli/structure/patterns.ts';
import { scriptIndex } from '#cli/structure/cross-file-index.ts';
import { docComment } from '#cli/structure/analyses/doc-comment.ts';
import { fileLength } from '#cli/structure/analyses/file/length.ts';
import type { Analysis, StructureContext } from '#cli/types/structure.ts';
import { folderNames } from '#cli/structure/analyses/folder-names.ts';
import { scriptEmbeds } from '#cli/structure/analyses/scripts/embeds.ts';
import { scriptSafety } from '#cli/structure/analyses/scripts/safety.ts';
import { privatePrefix } from '#cli/structure/analyses/private/prefix.ts';
import { deadParameters } from '#cli/structure/analyses/dead-parameters.ts';
import { functionLength } from '#cli/structure/analyses/function-length.ts';
import { envAccessOwner } from '#cli/structure/analyses/env-access-owner.ts';
import { trivialFunction } from '#cli/structure/analyses/trivial-function.ts';
import { unusedFunctions } from '#cli/structure/analyses/unused-functions.ts';
import { prefixCollisions } from '#cli/structure/analyses/prefix-collisions.ts';
import { scriptPolicy } from '#cli/structure/analyses/scripts/script-policy.ts';
import { scriptSshBlocks } from '#cli/structure/analyses/scripts/ssh-blocks.ts';
import { scriptBoundaries } from '#cli/structure/analyses/scripts/boundaries.ts';
import { singleFileFolder } from '#cli/structure/analyses/single-file-folder.ts';
import { scriptInterpreter } from '#cli/structure/analyses/scripts/interpreter.ts';
import { duplicateFunctions } from '#cli/structure/analyses/duplicate-functions.ts';
import { scriptConfigGuards } from '#cli/structure/analyses/scripts/config/guards.ts';
import { privateBeforePublic } from '#cli/structure/analyses/private/before-public.ts';
import { scriptConfigDefaults } from '#cli/structure/analyses/scripts/config/defaults.ts';
import { fileDirectoryCollision } from '#cli/structure/analyses/file/directory-collision.ts';

const ANALYSES: Record<string, Analysis> = {
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
        limit: (key, language) => input.view.limit(key, language),
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

/** Resolve the structure analysis while retaining source indexing at execution time. */
export function resolveStructure(spec: CheckSpec): Engine {
    const name = spec.analysis ?? '';
    const analysis: Analysis | undefined = COUNT_ANALYSES.has(name)
        ? async (context, scripts) => countFindings(name, context, await scripts())
        : ANALYSES[name];
    if (analysis === undefined) throw new Error(`No structure analysis is called ${name}.`);
    return async (input) => {
        const context = contextFor(input);
        const scriptFiles = context.files.filter((file) => file.tags.includes(SCRIPT_TAG));
        return analysis(context, () => scriptIndex(input, scriptFiles));
    };
}
