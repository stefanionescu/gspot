import { readSource } from '#cli/repository/tracked.ts';
import { KEY_GROUP } from '#cli/config/checks/security.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';

import {
    ENV_KEY_LINE,
    ENV_READ_PATTERNS,
    ENV_TEMPLATE_NAMES,
    ENV_READ_EXTENSIONS,
} from '#cli/config/repository/repository.ts';

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
    const inScope = input.files.filter((file) => input.scope === '' || file.path.startsWith(`${input.scope}/`));
    const templates = inScope.filter((file) => names.includes(file.path.slice(file.path.lastIndexOf('/') + 1)));
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
                    findings.push({
                        check: input.spec.name,
                        file: file.path,
                        line: index + 1,
                        rule: 'missing-key',
                        message: `${key} is read here and appears in no environment template.`,
                        fixable: false,
                    });
                }
            }
            return findings;
        });
    });
}
