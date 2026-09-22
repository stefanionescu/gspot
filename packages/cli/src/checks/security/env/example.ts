// Every environment variable the code reads appears in the environment template.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import type { EnvRead } from '#cli/checks/types.ts';
import type { TrackedFile } from '#cli/repository/types.ts';
import {
    ENV_KEY_LINE,
    ENV_READ_EXTENSIONS,
    ENV_READ_PATTERNS,
    ENV_TEMPLATE_NAMES,
} from '#cli/repository/env-files-definitions.ts';

const KEY_GROUP = 1;

function templateNames(input: EngineInput): string[] {
    const listed = input.view.tool('dotenv')['templates'];
    return Array.isArray(listed) ? listed.map(String) : ENV_TEMPLATE_NAMES;
}

function isTemplate(file: TrackedFile, names: string[]): boolean {
    const base = file.path.slice(file.path.lastIndexOf('/') + 1);
    return names.includes(base);
}

function keysOfTemplate(root: string, file: TrackedFile): string[] {
    const lines = readFileSync(join(root, file.path), 'utf8').split('\n');
    return lines.flatMap((line) => {
        const key = ENV_KEY_LINE.exec(line.trim())?.[KEY_GROUP];
        return key === undefined ? [] : [key];
    });
}

function readPatterns(input: EngineInput): RegExp[] {
    const accessor = input.view.tool('dotenv')['accessor'];
    if (typeof accessor !== 'string' || accessor === '') return ENV_READ_PATTERNS;
    const escaped = accessor.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
    return [...ENV_READ_PATTERNS, new RegExp(String.raw`\b${escaped}\(\s*['"]([A-Z][A-Z0-9_]*)['"]`, 'gu')];
}

// The claimed files are configuration; the reads are in code, so the whole scope is searched.
function isInScope(file: TrackedFile, scope: string): boolean {
    return scope === '' || file.path.startsWith(`${scope}/`);
}

function isSearched(file: TrackedFile): boolean {
    return file.nature === 'source' && ENV_READ_EXTENSIONS.some((extension) => file.path.endsWith(extension));
}

function readsOnLine(line: string, number: number, patterns: RegExp[]): EnvRead[] {
    return patterns.flatMap((pattern) =>
        line
            .matchAll(pattern)
            .flatMap((match) => {
                const key = match[KEY_GROUP];
                return key === undefined ? [] : [{ key, line: number }];
            })
            .toArray(),
    );
}

function readsIn(root: string, file: TrackedFile, patterns: RegExp[]): EnvRead[] {
    const lines = readFileSync(join(root, file.path), 'utf8').split('\n');
    return lines.flatMap((line, index) => readsOnLine(line, index + 1, patterns));
}

function firstMissing(reads: EnvRead[], known: Set<string>): EnvRead[] {
    const seen = new Set<string>();
    return reads.filter((read) => {
        if (known.has(read.key) || seen.has(read.key)) return false;
        seen.add(read.key);
        return true;
    });
}

/**
 * One finding per environment key the code reads and no template names; nothing when the scope has no template.
 * @param input the engine input
 * @returns the findings
 */
export function envExample(input: EngineInput): Promise<Finding[]> {
    const names = templateNames(input);
    const inScope = input.session.repository.files.filter((file) => isInScope(file, input.scope));
    const templates = inScope.filter((file) => isTemplate(file, names));
    if (templates.length === 0) return Promise.resolve([]);
    const known = new Set(templates.flatMap((file) => keysOfTemplate(input.root, file)));
    const patterns = readPatterns(input);
    const searched = inScope.filter((entry) => isSearched(entry));
    const findings = searched.flatMap((file) =>
        firstMissing(readsIn(input.root, file, patterns), known).map((read) => ({
            check: input.spec.name,
            file: file.path,
            line: read.line,
            rule: 'missing-key',
            message: `${read.key} is read here and appears in no environment template.`,
            fixable: false,
        })),
    );
    return Promise.resolve(findings);
}
