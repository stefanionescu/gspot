// The Supabase project: its config file, its function folders and its finding shape.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import { SUPABASE_CONFIG } from '#config/supabase.ts';
import type { SupabaseProject } from '#types/supabase.ts';

const DEFAULT_FUNCTIONS = 'supabase/functions';
const SHARED_PREFIX = '_';

/**
 * The parsed project file, or the text of the error when it does not parse, or undefined when the repository has none.
 * @param root the repository root
 * @returns the config or the error
 */
export function readProject(root: string): SupabaseProject | string | undefined {
    const path = join(root, SUPABASE_CONFIG);
    if (!existsSync(path)) return undefined;
    try {
        return Bun.TOML.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return error instanceof Error ? error.message : 'The file does not parse.';
    }
}

/**
 * The folders that hold one edge function each: every folder under the functions folder with an index file.
 * @param input the engine input
 * @returns the folder paths, repository-relative
 */
export function functionFolders(input: EngineInput): string[] {
    const named = input.view.tool('supabase')['functions_dir'];
    const base = typeof named === 'string' && named !== '' ? named : DEFAULT_FUNCTIONS;
    const folders = input.session.repository.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${base}/`) && /\/index\.tsx?$/u.test(path))
        .map((path) => path.slice(0, path.lastIndexOf('/')))
        .filter((folder) => folder.split('/').length === base.split('/').length + 1)
        .filter((folder) => !folder.slice(folder.lastIndexOf('/') + 1).startsWith(SHARED_PREFIX));
    return [...new Set(folders)];
}

/**
 * One finding of a supabase check.
 * @param input the engine input
 * @param at the file and the line
 * @param at.file the file
 * @param at.line the line
 * @param rule the rule
 * @param text the message
 * @returns the finding
 */
export function supabaseFinding(
    input: EngineInput,
    at: { file: string; line: number },
    rule: string,
    text: string,
): Finding {
    return { check: input.spec.id, file: at.file, line: at.line, rule, message: text, fixable: false };
}
