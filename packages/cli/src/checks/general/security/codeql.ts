import { join } from 'node:path';
import { readSource } from '#cli/platform/source.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { sarifLogSchema } from '#cli/parsers/schema/sarif.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { CODEQL } from '#cli/config/checks/general/security.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import { placeOf } from '#cli/checks/general/security/locations.ts';
import { codeqlLanguagesSchema } from '#cli/parsers/schema/codeql.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import type { AcceptedResult, CodeqlAnalysis, CodeqlLanguage } from '#cli/types/checks/general/security.ts';

async function runCodeql(input: EngineInput, argv: string[], cwd: string): Promise<string> {
    const result = await runEngineTool(input, [CODEQL, ...argv], { cwd });
    if (result.code !== 0)
        throw new Error(
            `${CODEQL} ${argv[0] ?? ''} ${argv[1] ?? ''} failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    return result.stdout;
}

async function analyzeLanguage(
    input: EngineInput,
    { language, version }: CodeqlLanguage,
    { suite, work, accepted, source }: CodeqlAnalysis,
): Promise<Finding[]> {
    const database = join(work, language);
    const output = join(work, `${language}.sarif`);
    await runCodeql(
        input,
        ['database', 'create', database, `--language=${language}`, '--source-root', source, '--overwrite'],
        source,
    );
    const queries = `codeql/${language}-queries@${version}:codeql-suites/${language}-${suite}.qls`;
    await runCodeql(
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
    const parsed = sarifLogSchema.parse(log);
    return parsed.runs.flatMap((run) => {
        const unsuccessful =
            run.invocations?.filter(
                (invocation) =>
                    invocation.executionSuccessful === false ||
                    invocation.toolExecutionNotifications?.some((notification) => notification.level === 'error') ===
                        true,
            ) ?? [];
        if (unsuccessful.length > 0) {
            const notifications = unsuccessful.flatMap((invocation) =>
                (invocation.toolExecutionNotifications ?? []).filter((notification) => notification.level === 'error'),
            );
            const detail = notifications
                .map((notification) => notification.message?.text)
                .filter((text) => text !== undefined)
                .join('\n');
            const diagnostic =
                detail === ''
                    ? 'CodeQL reported an unsuccessful analysis.'
                    : `CodeQL reported an unsuccessful analysis: ${detail}`;
            throw new Error(diagnostic);
        }
        return run.results
            .map((result) => ({
                check,
                ...placeOf(result.locations?.[0]?.physicalLocation, run, source),
                rule: result.ruleId ?? CODEQL,
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
    const tool = input.view.options(`tools.${CODEQL}`);
    const languages = (tool['languages'] as string[] | undefined) ?? [];
    const suite = tool['suite'] as string;
    const accepted = (tool['ignore'] as AcceptedResult[] | undefined) ?? [];
    for (const language of languages) {
        assertMutationTarget(language);
        assertMutationTarget(`${language}.sarif`);
    }
    if (languages.length === 0) return [];
    const metadata = codeqlLanguagesSchema.parse(
        JSON.parse(
            await runCodeql(
                input,
                ['resolve', 'languages', '--format=betterjson', '--filter-to-languages-with-queries'],
                input.root,
            ),
        ),
    );
    const packs = toolPin(input.manifests.values(), CODEQL).query_packs;
    const selected = [...new Set(languages.map((language) => metadata.aliases[language] ?? language))].map(
        (language) => {
            const version = packs?.[language];
            if (version === undefined) throw new Error(`No CodeQL query pack is pinned for ${language}.`);
            if (metadata.extractors[language]?.length !== 1)
                throw new Error(`CodeQL has no single extractor for ${language}.`);
            return { language, version };
        },
    );
    using workFolder = scratchFolder('gspot-codeql-');
    const work = workFolder.path;
    using sourceFolder = await copyIntoScratch(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const source = sourceFolder.path;
    const findings: Finding[] = [];
    for (const language of selected) {
        try {
            findings.push(...(await analyzeLanguage(input, language, { suite, work, accepted, source })));
        } catch (error) {
            throw new Error(
                `CodeQL analysis of ${language.language} failed: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            );
        }
    }
    return findings;
}
