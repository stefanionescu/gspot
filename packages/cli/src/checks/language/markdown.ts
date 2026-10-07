import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { parseBashSyntaxResult, findFenceSyntaxProblems } from '#cli/parsers/markdown.ts';

/**
 * Report invalid tagged examples at their error lines; Bash executes through the same native tool boundary.
 * @param input the selected Markdown files and tool execution state
 * @returns one syntax finding per invalid code example
 */
export async function fences(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source' || !file.path.endsWith('.md')) continue;
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        const problems = await findFenceSyntaxProblems(
            text,
            async (body) =>
                parseBashSyntaxResult(await runEngineTool(input, ['bash', '-n'], { cwd: input.root, stdin: body })),
            input,
        );
        findings.push(
            ...problems.map((problem) =>
                findingAt(
                    input,
                    { file: file.path, line: problem.line },
                    'syntax',
                    `Fix this code example: ${problem.message}`,
                ),
            ),
        );
    }
    return findings;
}
