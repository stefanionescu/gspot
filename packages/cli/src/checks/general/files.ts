import { posix } from 'node:path';
import { escapeRegExp } from '#cli/platform/text.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { ENV_KEY_LINE, ENV_READ_PATTERNS } from '#cli/config/checks/general/files.ts';

function envReadPatterns(input: EngineInput): RegExp[] {
    const accessor = input.view.options('dotenv')['accessor'];
    if (typeof accessor !== 'string' || accessor === '') return ENV_READ_PATTERNS;
    const escaped = escapeRegExp(accessor);
    return [...ENV_READ_PATTERNS, new RegExp(String.raw`\b${escaped}\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]`, 'gu')];
}

/**
 * Reports each environment key the code reads that no template lists. Reports nothing when the scope has no template.
 * @param input the engine input
 * @returns the findings
 */
export function envExample(input: EngineInput): Finding[] {
    const names = input.view.options('dotenv')['templates'] as string[];
    // The owned files are configuration; the reads are in code, so the whole scope is inspected.
    const inScope = input.files.filter((file) => isInScope(file.path, input.scope));
    const templates = inScope.filter((file) => names.includes(posix.basename(file.path)));
    if (templates.length === 0) return [];
    const known = new Set(
        templates.flatMap((file) => {
            const lines = readSource(input.root, file.path, input.reads).toString('utf8').split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const patterns = envReadPatterns(input);
    const extensions = extensionsTagged('javascript', 'typescript', 'python', 'vue', 'svelte', 'astro');
    const candidates = inScope.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
    return candidates.flatMap((file) => {
        const lines = readSource(input.root, file.path, input.reads).toString('utf8').split('\n');
        const seen = new Set<string>();
        return lines.flatMap((line, index) => {
            const findings: Finding[] = [];
            for (const pattern of patterns) {
                for (const match of line.matchAll(pattern)) {
                    const key = match.groups?.['key'];
                    if (key === undefined || known.has(key) || seen.has(key)) continue;
                    seen.add(key);
                    findings.push(
                        findingAt(
                            input,
                            { file: file.path, line: index + 1 },
                            'missing-key',
                            `${key} is read here and appears in no environment template.`,
                        ),
                    );
                }
            }
            return findings;
        });
    });
}
