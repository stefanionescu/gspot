import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { parseHeaders, parseWrangler, redirectFindings } from '#cli/parsers/tool/public.ts';
import { REQUIRED_HEADERS, COMPATIBILITY_DATE } from '#cli/config/checks/platform/cloudflare.ts';

function scopePathsNamed(input: CheckInput, name: string): string[] {
    return input.files.map((file) => file.path).filter((path) => path === name || path.endsWith(`/${name}`));
}

/**
 * The syntax findings of every redirects file.
 * @param input the check input
 * @returns the findings
 */
export function redirects(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_redirects').flatMap((path) =>
        redirectFindings(readSource(input.root, path, input.reads).toString('utf8')).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the check input
 * @returns the findings
 */
export function wrangler(input: CheckInput): Finding[] {
    const paths = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].flatMap((name) => scopePathsNamed(input, name));
    return paths.flatMap((path): Finding[] => {
        const { table, problem } = parseWrangler(readSource(input.root, path, input.reads).toString('utf8'), path);
        if (problem !== undefined) return [findingAt(input, { file: path, line: 1 }, 'syntax', problem)];
        const unnamed =
            typeof table['name'] === 'string'
                ? []
                : [findingAt(input, { file: path, line: 1 }, 'missing-name', 'The configuration names no worker.')];
        const date = table['compatibility_date'];
        const undated =
            typeof date === 'string' && COMPATIBILITY_DATE.test(date)
                ? []
                : [
                      findingAt(
                          input,
                          { file: path, line: 1 },
                          'compatibility-date',
                          'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
                      ),
                  ];
        return [...unnamed, ...undated];
    });
}
/**
 * The syntax findings of every headers file.
 * @param input the check input
 * @returns the findings
 */
export function headers(input: CheckInput): Finding[] {
    return scopePathsNamed(input, '_headers').flatMap((path) =>
        parseHeaders(readSource(input.root, path, input.reads).toString('utf8')).findings.map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * The headers file sets the security headers for every path.
 * @param input the check input
 * @returns the findings
 */
export function securityHeaders(input: CheckInput): Finding[] {
    const files = input.files.filter((file) => file.path === '_headers' || file.path.endsWith('/_headers'));
    return files.flatMap((file) => {
        const { blocks } = parseHeaders(readSource(input.root, file.path, input.reads).toString('utf8'));
        const held = new Map(
            blocks
                .filter((block) => block.path === '/*')
                .flatMap((block) => block.headers.map(({ name, value }) => [name, value])),
        );
        const hasFrameRule = /frame-ancestors/iu.test(held.get('content-security-policy') ?? '');
        return Object.entries(REQUIRED_HEADERS)
            .filter(
                ([name, pattern]) =>
                    !pattern.test(held.get(name) ?? '') && !(name === 'x-frame-options' && hasFrameRule),
            )
            .map(([name]) =>
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'missing-header',
                    `The block for /* sets no valid ${name} header.`,
                ),
            );
    });
}
