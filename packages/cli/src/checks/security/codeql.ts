// CodeQL on request: one database and one analysis per language, with the accepted results taken out by rule and path.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import type { AcceptedResult, SarifLog, SarifResult } from '#cli/checks/types.ts';

const TOOL = 'codeql';
const SCAN_TIMEOUT_MS = 3_600_000;
const DEFAULT_SUITE = 'security-extended';

function isAccepted(accepted: AcceptedResult[], rule: string, file: string): boolean {
    return accepted.some((entry) => entry.rule === rule && pathMatcher(entry.paths)(file));
}

async function spawned(argv: string[], cwd: string): Promise<void> {
    const result = await run([TOOL, ...argv], { cwd, timeoutMs: SCAN_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError(`${TOOL} is not installed.`);
    if (result.code !== 0)
        throw new Error(
            `${TOOL} ${argv[0] ?? ''} ${argv[1] ?? ''} failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
        );
}

async function scanned(input: EngineInput, language: string, suite: string, work: string): Promise<SarifLog> {
    const database = join(work, language);
    const output = join(work, `${language}.sarif`);
    await spawned(
        ['database', 'create', database, `--language=${language}`, '--source-root', input.root, '--overwrite'],
        input.root,
    );
    const queries = `codeql/${language}-queries:codeql-suites/${language}-${suite}.qls`;
    await spawned(
        ['database', 'analyze', database, queries, '--download', '--format=sarif-latest', `--output=${output}`],
        input.root,
    );
    return JSON.parse(readFileSync(output, 'utf8')) as SarifLog;
}

function placeOf(result: SarifResult): { file: string; line: number } {
    const [first] = result.locations ?? [];
    const place = first?.physicalLocation;
    if (place === undefined) return { file: '', line: 1 };
    return { file: place.artifactLocation?.uri ?? '', line: place.region?.startLine ?? 1 };
}

/**
 * The findings of one SARIF log, minus the results the policy accepts.
 * @param log the parsed log
 * @param check the check id the findings carry
 * @param accepted the accepted results, each a rule id, the paths and a reason
 * @returns the findings
 */
export function sarifFindings(log: SarifLog, check: string, accepted: AcceptedResult[]): Finding[] {
    const results = (log.runs ?? []).flatMap((entry) => entry.results ?? []);
    return results
        .map((result) => ({
            check: check,
            ...placeOf(result),
            rule: result.ruleId ?? TOOL,
            message: result.message?.text ?? 'CodeQL reports a result here.',
            fixable: false,
        }))
        .filter((finding) => !isAccepted(accepted, finding.rule ?? '', finding.file));
}

/**
 * Runs CodeQL for every language in tools.codeql.languages and returns the results the policy does not accept.
 * @param input the engine input
 * @returns the findings
 */
export async function codeql(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool(TOOL);
    const languages = (tool['languages'] as string[] | undefined) ?? [];
    const suite = (tool['suite'] as string | undefined) ?? DEFAULT_SUITE;
    const accepted = (tool['false_positives'] as AcceptedResult[] | undefined) ?? [];
    const work = mkdtempSync(join(tmpdir(), 'gspot-codeql-'));
    const findings: Finding[] = [];
    try {
        for (const language of languages) {
            const log = await scanned(input, language, suite, work);
            findings.push(...sarifFindings(log, input.spec.name, accepted));
        }
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
    return findings;
}
