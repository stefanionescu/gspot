// django/migrations-fresh: asks Django whether the models and the migrations agree.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const ENTRY = 'manage.py';
const COMMAND_TIMEOUT_MS = 600_000;
const CHANGES = /^Migrations for '(?<app>[^']+)':$/u;

function inScope(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

// A project with a uv lockfile runs in the environment uv keeps, and any other project in the Python on the PATH.
function interpreter(cwd: string): string[] {
    return existsSync(join(cwd, 'uv.lock')) ? ['uv', 'run', 'python'] : ['python3'];
}

/**
 * One finding for each app whose models changed with no migration to record it.
 * @param input the engine input
 * @returns the findings
 */
export async function djangoMigrationsFresh(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, ENTRY))) return [];
    const command = [...interpreter(cwd), ENTRY, 'makemigrations', '--check', '--dry-run'];
    const result = await run(command, { cwd, timeoutMs: COMMAND_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError(`The ${command[0] ?? 'python3'} command is not installed.`);
    const said = `${result.stdout}\n${result.stderr}`;
    if (said.includes("No module named 'django'"))
        throw new MissingToolError('Django is not installed in the environment that runs manage.py.');
    if (result.code === 0) return [];
    const apps = said.split('\n').flatMap((line) => {
        const app = CHANGES.exec(line.trim())?.groups?.['app'];
        return app === undefined ? [] : [app];
    });
    if (apps.length === 0)
        throw new Error(`The makemigrations command failed: ${said.trim().split('\n').at(-1) ?? ''}`);
    return apps.map((app) => ({
        check: input.spec.id,
        file: inScope(input, ENTRY),
        line: 1,
        rule: 'missing-migration',
        message: `The models of ${app} changed and no migration records it. Run makemigrations and commit the file.`,
        fixable: false,
    }));
}
