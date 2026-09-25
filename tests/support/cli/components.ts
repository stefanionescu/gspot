// Planted component repositories: the files, the private tools, and the all level each component test starts from.
import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
// init selects every recommendation it can, so a sandbox names the ones it leaves out.
const RECOMMENDED = ['naming', 'spelling', 'vitest', 'typescript', 'css'];

/** The strict compiler options every planted TypeScript component repository reads. */
export const COMPONENT_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n';

/** A TypeScript module every planted TypeScript component repository holds, so the compiler has an input. */
export const COMPONENT_SOURCE =
    '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';

/**
 * Plants a component repository, installs its configurations at the all level, and returns the command environment.
 * @param root the empty sandbox
 * @param configurations the configurations init selects
 * @param dependencies the framework packages of the planted manifest
 * @param files the source files of the repository
 * @returns the PATH every gspot command of the test runs with
 */
export async function installComponents(
    root: string,
    configurations: string[],
    dependencies: Record<string, string>,
    files: Record<string, string>,
): Promise<Record<string, string>> {
    const manifest = { name: 'planted', version: '1.0.0', private: true, type: 'module', dependencies };
    await createFileTree(root, {
        '.gitignore': 'node_modules\n',
        'package.json': `${JSON.stringify(manifest, null, 4)}\n`,
        ...files,
    });
    symlinkSync(MODULES, join(root, 'node_modules'));
    commitAll(root);
    const environment = { PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
    const without = RECOMMENDED.filter((name) => !configurations.includes(name));
    const init = ['init', '--yes', '--configurations', ...configurations, '--without', ...without];
    await install(root, [...init, '--no-runner', '--no-ci', '--no-hooks', '--no-rules', '--no-install'], environment);
    const selected = await run(root, ['set', 'level', 'all'], environment);
    if (selected.code !== 0) throw new Error(`The all level was not selected: ${selected.stdout}${selected.stderr}`);
    return environment;
}
