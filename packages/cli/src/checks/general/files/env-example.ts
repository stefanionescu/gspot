import { baseName } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { ENV_TEMPLATE_NAMES } from '#cli/config/repository/repository.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { KEY_GROUP, ENV_KEY_LINE, ENV_READ_PATTERNS, ENV_READ_EXTENSIONS } from '#cli/config/checks/general/files.ts';

function readPatterns(input: EngineInput): RegExp[] {
    const accessor = input.view.tool('dotenv')['accessor'];
    if (typeof accessor !== 'string' || accessor === '') return ENV_READ_PATTERNS;
    const escaped = accessor.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
    return [...ENV_READ_PATTERNS, new RegExp(String.raw`\b${escaped}\(\s*['"]([A-Z][A-Z0-9_]*)['"]`, 'gu')];
}

/**
 * One finding per environment key the code reads and no template names; nothing when the scope has no template.
 * @param input the engine input
 * @returns the findings
 */
export function envExample(input: EngineInput): Finding[] {
    const listed = input.view.tool('dotenv')['templates'];
    const names = Array.isArray(listed) ? listed.map(String) : ENV_TEMPLATE_NAMES;
    // The owned files are configuration; the reads are in code, so the whole scope is searched.
    const inScope = input.files.filter((file) => isInScope(file.path, input.scope));
    const templates = inScope.filter((file) => names.includes(baseName(file.path)));
    if (templates.length === 0) return [];
    const known = new Set(
        templates.flatMap((file) => {
            const lines = readSource(input.root, file.path, input.reads).toString('utf8').split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.[KEY_GROUP];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const patterns = readPatterns(input);
    const searched = inScope.filter(
        (file) => file.kind === 'source' && ENV_READ_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    return searched.flatMap((file) => {
        const lines = readSource(input.root, file.path, input.reads).toString('utf8').split('\n');
        const seen = new Set<string>();
        return lines.flatMap((line, index) => {
            const findings: Finding[] = [];
            for (const pattern of patterns) {
                for (const match of line.matchAll(pattern)) {
                    const key = match[KEY_GROUP];
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
