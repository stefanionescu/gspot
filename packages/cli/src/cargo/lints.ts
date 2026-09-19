// rust/clippy: the crate built with Clippy, where every warning is an error, read from the JSON the compiler prints.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { CompilerLine } from '#types/cargo.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const MANIFEST = 'Cargo.toml';
const BUILD_TIMEOUT_MS = 1_800_000;
const REPORTED = new Set(['warning', 'error']);
// Every compiler warning, the two Clippy groups that find mistakes, and the restriction lints that keep a panic out of shipped code.
const DENIED = [
    'warnings',
    'missing_docs',
    'clippy::all',
    'clippy::pedantic',
    'clippy::cognitive_complexity',
    'clippy::unwrap_used',
    'clippy::expect_used',
    'clippy::panic',
    'clippy::todo',
    'clippy::unimplemented',
    'clippy::dbg_macro',
    'clippy::undocumented_unsafe_blocks',
];

function inScope(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

function parsed(line: string): CompilerLine | undefined {
    if (!line.startsWith('{')) return undefined;
    try {
        return JSON.parse(line) as CompilerLine;
    } catch {
        return undefined;
    }
}

// One finding for a compiler message that names a place. The summary line that counts the errors names none.
function findingOf(input: EngineInput, entry: CompilerLine): Finding[] {
    const told = entry.message;
    const span = told?.spans.find((candidate) => candidate.is_primary);
    if (told === undefined || span === undefined || entry.reason !== 'compiler-message') return [];
    if (!REPORTED.has(told.level)) return [];
    return [
        {
            check: input.spec.id,
            file: inScope(input, span.file_name),
            line: span.line_start,
            column: span.column_start,
            rule: told.code?.code ?? 'rustc',
            message: told.message,
            fixable: false,
        },
    ];
}

/**
 * Builds the crate of the scope with Clippy and reports each finding once, though the library and its tests both print it.
 * @param input the engine input
 * @returns the findings
 */
export async function rustClippy(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, MANIFEST))) return [];
    const settingsFolder = join(input.root, '.gspot');
    const command = [
        'cargo',
        'clippy',
        '--all-targets',
        '--message-format=json',
        '--',
        ...DENIED.flatMap((lint) => ['-D', lint]),
    ];
    const result = await run(command, { cwd, timeoutMs: BUILD_TIMEOUT_MS, env: { CLIPPY_CONF_DIR: settingsFolder } });
    if (result.missing) throw new MissingToolError('The cargo command is not installed.');
    const found = result.stdout.split('\n').flatMap((line) => {
        const entry = parsed(line);
        return entry === undefined ? [] : findingOf(input, entry);
    });
    const unique = new Map(
        found.map((finding) => [`${finding.file}:${String(finding.line)}:${finding.rule ?? ''}`, finding]),
    );
    if (result.code !== 0 && unique.size === 0)
        throw new Error(`The cargo clippy command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return unique.values().toArray();
}
