import { z } from 'zod';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { toolPin } from '#cli/tools/inspect.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import { placeOf, sarifLog } from '#cli/checks/security/sarif.ts';
import type { AcceptedResult } from '#cli/types/checks/security.ts';
import type { Finding, EngineInput } from '#cli/types/checks/checks.ts';
import { CODEQL_TOOL, DEFAULT_SUITE } from '#cli/constants/checks/security.ts';

async function spawned(input: EngineInput, argv: string[], cwd: string): Promise<string> {
    const result = await runCheckCommand(input, [CODEQL_TOOL, ...argv], { cwd });
    if (result.code !== 0)
        throw new Error(
            `${CODEQL_TOOL} ${argv[0] ?? ''} ${argv[1] ?? ''} failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
        );
    return result.stdout;
}

async function scanned(
    input: EngineInput,
    language: string,
    suite: string,
    work: string,
    accepted: AcceptedResult[],
    version: string,
): Promise<Finding[]> {
    const database = join(work, language);
    const output = join(work, `${language}.sarif`);
    const source = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    try {
        await spawned(
            input,
            ['database', 'create', database, `--language=${language}`, '--source-root', source, '--overwrite'],
            source,
        );
        const queries = `codeql/${language}-queries@${version}:codeql-suites/${language}-${suite}.qls`;
        await spawned(
            input,
            ['database', 'analyze', database, queries, '--download', '--format=sarif-latest', `--output=${output}`],
            source,
        );
        return sarifFindings(
            JSON.parse(readSource(work, `${language}.sarif`).toString('utf8')),
            input.spec.name,
            accepted,
            source,
        );
    } finally {
        await rm(source, { recursive: true, force: true });
    }
}

/**
 * Validate a CodeQL report and apply accepted results to repository-relative source locations.
 * @param log the parsed SARIF log.
 * @param check the check name the findings carry.
 * @param accepted the results the policy accepts.
 * @param source the copy of the repository the analysis ran in.
 * @returns the findings the policy does not accept.
 */
export function sarifFindings(log: unknown, check: string, accepted: AcceptedResult[], source: string): Finding[] {
    const parsed = sarifLog.parse(log);
    return parsed.runs.flatMap((run) => {
        if (
            run.invocations?.some(
                (invocation) =>
                    invocation.executionSuccessful === false ||
                    invocation.toolExecutionNotifications?.some((notification) => notification.level === 'error') ===
                        true,
            ) === true
        )
            throw new Error('CodeQL reported an unsuccessful analysis. Repair the native scan before retrying.');
        return run.results
            .map((result) => ({
                check,
                ...placeOf(result.locations?.[0]?.physicalLocation, run, source),
                rule: result.ruleId ?? CODEQL_TOOL,
                message: result.message?.text ?? 'CodeQL reports a result here.',
                fixable: false,
            }))
            .filter(
                (finding) =>
                    !accepted.some((entry) => entry.rule === finding.rule && pathMatcher(entry.paths)(finding.file)),
            );
    });
}

/**
 * Runs CodeQL for every language in tools.codeql.languages and returns the results the policy does not accept.
 * @param input the engine input
 * @returns the findings
 */
export async function codeql(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool(CODEQL_TOOL);
    const languages = (tool['languages'] as string[] | undefined) ?? [];
    const suite = (tool['suite'] as string | undefined) ?? DEFAULT_SUITE;
    const accepted = (tool['false_positives'] as AcceptedResult[] | undefined) ?? [];
    for (const language of languages) {
        mutationTarget(language);
        mutationTarget(`${language}.sarif`);
    }
    if (languages.length === 0) return [];
    const metadata = z
        .object({
            aliases: z.record(z.string(), z.string()),
            extractors: z.record(z.string(), z.array(z.unknown())),
        })
        .parse(
            JSON.parse(
                await spawned(
                    input,
                    ['resolve', 'languages', '--format=betterjson', '--filter-to-languages-with-queries'],
                    input.root,
                ),
            ),
        );
    const packs = toolPin(input.manifests.values(), CODEQL_TOOL).query_packs;
    const selected = [...new Set(languages.map((language) => metadata.aliases[language] ?? language))].map(
        (language) => {
            const version = packs?.[language];
            if (version === undefined || metadata.extractors[language]?.length !== 1)
                throw new Error(`CodeQL language ${language} has no unambiguous extractor and pinned query pack.`);
            return { language, version };
        },
    );
    const work = mkdtempSync(join(tmpdir(), 'gspot-codeql-'));
    const findings: Finding[] = [];
    try {
        for (const { language, version } of selected) {
            findings.push(...(await scanned(input, language, suite, work, accepted, version)));
        }
    } finally {
        await rm(work, { recursive: true, force: true });
    }
    return findings;
}
