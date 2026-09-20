import type { EngineInput } from '#types/run.ts';
// The structure engine: one analysis per check, chosen by `analysis =` in the manifest.
import type { Finding } from '#types/finding.ts';
import { DOCUMENT_EXTENSIONS } from '#config/shell.ts';
import { countFindings } from '#cli/structure/counts.ts';
import { shellIndex } from '#cli/structure/cross-file-index.ts';
import { docComment } from '#cli/structure/analyses/doc-comment.ts';
import { fileLength } from '#cli/structure/analyses/file/length.ts';
import type { Analysis, StructureContext } from '#types/structure.ts';
import { callThrough } from '#cli/structure/analyses/call-through.ts';
import { folderNames } from '#cli/structure/analyses/folder-names.ts';
import { shellEmbeds } from '#cli/structure/analyses/shell/embeds.ts';
import { shellSafety } from '#cli/structure/analyses/shell/safety.ts';
import { privatePrefix } from '#cli/structure/analyses/private/prefix.ts';
import { deadParameters } from '#cli/structure/analyses/dead-parameters.ts';
import { functionLength } from '#cli/structure/analyses/function-length.ts';
import { envAccessOwner } from '#cli/structure/analyses/env-access-owner.ts';
import { shellSshBlocks } from '#cli/structure/analyses/shell/ssh-blocks.ts';
import { shellBoundaries } from '#cli/structure/analyses/shell/boundaries.ts';
import { trivialFunction } from '#cli/structure/analyses/trivial-function.ts';
import { unusedFunctions } from '#cli/structure/analyses/unused-functions.ts';
import { prefixCollisions } from '#cli/structure/analyses/prefix-collisions.ts';
import { shellInterpreter } from '#cli/structure/analyses/shell/interpreter.ts';
import { singleFileFolder } from '#cli/structure/analyses/single-file-folder.ts';
import { shellConfigGuards } from '#cli/structure/analyses/shell/config/guards.ts';
import { shellScriptPolicy } from '#cli/structure/analyses/shell/script-policy.ts';
import { duplicateFunctions } from '#cli/structure/analyses/duplicate-functions.ts';
import { privateBeforePublic } from '#cli/structure/analyses/private/before-public.ts';
import { shellConfigDefaults } from '#cli/structure/analyses/shell/config/defaults.ts';
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
    'call-through': callThrough,
    'env-access-owner': envAccessOwner,
    'shell-interpreter': shellInterpreter,
    'shell-script-policy': shellScriptPolicy,
    'shell-embeds': shellEmbeds,
    'shell-ssh-blocks': shellSshBlocks,
    'shell-config-defaults': shellConfigDefaults,
    'shell-config-guards': shellConfigGuards,
    'shell-boundaries': shellBoundaries,
    'shell-safety': shellSafety,
};
const COUNT_ANALYSES = new Set(['shell-branches', 'shell-nesting', 'shell-mutable-assignments']);
const SHELL_TAG = 'shell';
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

/**
 * Runs the analysis a structure check names.
 * @param input the engine input
 * @returns the findings
 */
export async function runStructure(input: EngineInput): Promise<Finding[]> {
    const analysis = input.spec.analysis ?? '';
    const context = contextFor(input);
    const shellFiles = context.files.filter((file) => file.tags.includes(SHELL_TAG));
    const shell = (): ReturnType<typeof shellIndex> => shellIndex(input, shellFiles);
    if (COUNT_ANALYSES.has(analysis)) return countFindings(analysis, context, await shell());
    const run = ANALYSES[analysis];
    if (run === undefined) throw new Error(`No structure analysis is called ${analysis}.`);
    return run(context, shell);
}
