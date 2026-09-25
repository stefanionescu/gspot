import type { Finding } from '#cli/checks/result.ts';
import { countFindings } from '#cli/checks/structure/counts.ts';
import type { ScriptIndex } from '#cli/checks/structure/parser.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { Engine, EngineInput } from '#cli/checks/input.ts';
import { DOCUMENT_EXTENSIONS } from '#cli/checks/structure/patterns.ts';
import { scriptIndex } from '#cli/checks/structure/cross-file-index.ts';
import { docComment } from '#cli/checks/structure/doc-comment.ts';
import { fileLength } from '#cli/checks/structure/file-layout.ts';
import { folderNames } from '#cli/checks/structure/folder-names.ts';
import { scriptEmbeds } from '#cli/checks/structure/scripts/embeds.ts';
import { scriptSafety } from '#cli/checks/structure/scripts/safety.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { privatePrefix } from '#cli/checks/structure/visibility.ts';
import { deadParameters } from '#cli/checks/structure/dead-parameters.ts';
import { functionLength } from '#cli/checks/structure/function-length.ts';
import { envAccessOwner } from '#cli/checks/structure/env-access-owner.ts';
import { trivialFunction } from '#cli/checks/structure/trivial-function.ts';
import { unusedFunctions } from '#cli/checks/structure/unused-functions.ts';
import { prefixCollisions } from '#cli/checks/structure/prefix-collisions.ts';
import { scriptPolicy } from '#cli/checks/structure/scripts/script-policy.ts';
import { scriptSshBlocks } from '#cli/checks/structure/scripts/ssh-blocks.ts';
import { scriptBoundaries } from '#cli/checks/structure/scripts/boundaries.ts';
import { singleFileFolder } from '#cli/checks/structure/single-file-folder.ts';
import { scriptInterpreter } from '#cli/checks/structure/scripts/interpreter.ts';
import { duplicateFunctions } from '#cli/checks/structure/duplicate-functions.ts';
import { scriptConfigGuards } from '#cli/checks/structure/scripts/configuration.ts';
import { privateBeforePublic } from '#cli/checks/structure/visibility.ts';
import { scriptConfigDefaults } from '#cli/checks/structure/scripts/configuration.ts';
import { fileDirectoryCollision } from '#cli/checks/structure/file-layout.ts';

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
 * @param spec
 */
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

/** What every analysis receives. */
export type StructureContext = {
    input: EngineInput;
    /** The files this check runs over. */
    files: TrackedFile[];
    /** A limit by its `[limits]` key, read for the file's language. */
    limit: (key: string, language?: string) => number | undefined;
    /** A `[tools.bash]` text slot, or the fallback. */
    bashText: (slot: string, otherwise: string) => string;
    /** A `[tools.bash]` list slot, empty when unset. */
    bashList: (slot: string) => string[];
    /** A `[tools.bash]` slot as written. */
    bashSetting: (slot: string) => unknown;
    /** A finding for this check. */
    report: (file: string, line: number, rule: string, message: string) => Finding;
};

/** One analysis: a function over the context that returns findings. */
export type Analysis = (
    context: StructureContext,
    scripts: () => Promise<ScriptIndex>,
) => Finding[] | Promise<Finding[]>;

export type StructureProblem = { file: string; line: number; rule: string; text: string };
