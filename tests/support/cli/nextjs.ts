// A planted Next.js project with next-intl, installed with its private tools at the all level.
import { expect } from 'bun:test';
import { symlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';

/** init selecting nextjs without the recommendations the tests leave out. */
const NEXT_INIT = initArgs(['nextjs'], ['naming', 'spelling', 'css', 'configs']);

/**
 * The package manifest of the planted project.
 * @param reactDom the react-dom version, aligned with React or not
 * @returns the manifest text
 */
const NEXT_CONFIG =
    '// The framework configuration.\nconst config = { reactStrictMode: true };\n\nexport default config;\n';
/** The home page. */

export const nextManifest = (reactDom: string): string =>
    `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "next": "16.3.5",\n        "next-intl": "4.3.9",\n        "react": "19.1.1",\n        "react-dom": "${reactDom}"\n    }\n}\n`;
/** The framework configuration with the build check on. */
export const NEXT_PAGE =
    '// The home page.\n\n/**\n * Renders the home page.\n * @returns the page\n */\nexport default function Page(): string {\n    return "home";\n}\n';
/** The root layout. */
export const NEXT_LAYOUT =
    '// The root layout.\nimport type { ReactNode } from \'react\';\n\n/**\n * Wraps every page.\n * @param props the children\n * @param props.children the page\n * @returns the document\n */\nexport default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {\n    return (\n        <html lang="en">\n            <body>{children}</body>\n        </html>\n    );\n}\n';
/** The i18n settings naming the message directory and base locale. */
export const NEXT_TRANSLATIONS = '[tools.i18n]\ntranslations = {directory = "messages", base = "en"}\n';

/**
 * Plants the project beside this repository's node_modules, initializes it, and sets the all level.
 * @returns the sandbox and the environment its commands run with
 */
export async function installedNextProject(): Promise<{
    sandbox: Awaited<ReturnType<typeof testdir>>;
    environment: Record<string, string>;
}> {
    // Webpack requires the linked dependencies and the sandbox to share a drive.
    const sandbox = await testdir(
        {},
        { dirname: join(join(INSTALLED_MODULES, '../..'), 'gspot-test-' + randomUUID()) },
    );
    try {
        await createFileTree(sandbox.path, {
            '.gitignore': 'node_modules\n.next\n',
            'package.json': nextManifest('19.1.1'),
            'tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "DOM.Iterable", "ES2022"],\n        "noEmit": true,\n        "plugins": [{ "name": "next" }]\n    },\n    "include": ["app"]\n}\n',
            'next.config.mjs': NEXT_CONFIG,
            'app/page.tsx': NEXT_PAGE,
            'app/layout.tsx': NEXT_LAYOUT,
            'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
            'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
        });
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'));
        commitAll(sandbox.path);
        const environment = {
            PATH: `${join(INSTALLED_MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
        };
        await install(sandbox.path, NEXT_INIT, environment);
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        return { sandbox, environment };
    } catch (error) {
        await sandbox[Symbol.asyncDispose]();
        throw error;
    }
}
