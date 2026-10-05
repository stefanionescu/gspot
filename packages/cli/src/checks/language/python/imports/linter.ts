// The import contracts of a Python project, run through import-linter when pyproject.toml declares them.
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { GspotError } from '#cli/platform/errors.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { importLinterSchema } from '#cli/parsers/schema/python/imports.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { BROKEN_CONTRACT, PYTHON_MANIFEST } from '#cli/config/checks/language/python.ts';

/**
 * Runs the import contracts of the scope. A project with no [tool.importlinter] table has none to run.
 * @param input the engine input
 * @returns one finding for each broken contract
 */
export async function importLinter(input: EngineInput): Promise<Finding[]> {
    const manifest = input.scope === '' ? PYTHON_MANIFEST : `${input.scope}/${PYTHON_MANIFEST}`;
    if (statSync(join(input.root, manifest), { throwIfNoEntry: false }) === undefined)
        throw new GspotError('skip', 'This scope has no pyproject.toml import contracts.');
    const project = importLinterSchema.parse(parse(readSource(input.root, manifest, input.reads).toString('utf8')));
    if (project.tool?.importlinter === undefined)
        throw new GspotError('skip', 'This scope has no tool.importlinter configuration.');
    const result = await runEngineTool(input, ['lint-imports', '--no-cache'], {
        cwd: join(input.root, input.scope),
    });
    const broken = result.stdout.split('\n').flatMap((line) => {
        const name = BROKEN_CONTRACT.exec(line.trim())?.groups?.['name'];
        return name === undefined ? [] : [name];
    });
    if (result.code !== 0 && broken.length === 0)
        throw new Error(
            `The lint-imports command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const at = { file: manifest, line: 1 };
    return broken.map((name) =>
        findingAt(input, at, 'contract', `The import contract "${name}" is broken; lint-imports prints the chain.`),
    );
}
