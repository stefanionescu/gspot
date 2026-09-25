// A planted repository with its private tools installed: the files, the selected configurations, and the level each framework test starts from.
import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const QUIET = ['--no-runner', '--no-ci', '--no-hooks', '--no-rules', '--no-install'];

/** The strict compiler options a planted TypeScript repository reads. */
export const COMPONENT_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n';

/** A TypeScript module a planted repository holds, so the compiler has an input. */
export const COMPONENT_SOURCE =
    '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';

/** What a planted repository holds and selects. */
export type Sandbox = {
    /** The configurations init selects by name. */
    configurations: string[];
    /** The packages the planted manifest depends on; no manifest is written without them. */
    dependencies?: Record<string, string>;
    /** The source files of the repository. */
    files: Record<string, string>;
    /** Recommended configurations left out; naming and spelling always are. */
    without?: string[];
    /** The level set after init; all unless a test says otherwise. */
    level?: 'recommended' | 'all';
};

/**
 * Plants a repository, installs its configurations and private tools, and returns the command environment.
 * @param root the empty sandbox
 * @param sandbox what the repository holds and selects
 * @returns the PATH every gspot command of the test runs with
 */
export async function installSandbox(root: string, sandbox: Sandbox): Promise<Record<string, string>> {
    const manifest =
        sandbox.dependencies === undefined
            ? {}
            : {
                  'package.json': `${JSON.stringify(
                      {
                          name: 'planted',
                          version: '1.0.0',
                          private: true,
                          type: 'module',
                          dependencies: sandbox.dependencies,
                      },
                      null,
                      4,
                  )}\n`,
              };
    await createFileTree(root, { '.gitignore': 'node_modules\n', ...manifest, ...sandbox.files });
    symlinkSync(MODULES, join(root, 'node_modules'));
    commitAll(root);
    const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
    const without = ['naming', 'spelling', ...(sandbox.without ?? [])];
    const argv = ['init', '--yes', '--configurations', ...sandbox.configurations, '--without', ...without, ...QUIET];
    await install(root, argv, environment);
    const level = sandbox.level ?? 'all';
    const selected = await run(root, ['set', 'level', level], environment);
    if (selected.code !== 0)
        throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    return environment;
}
