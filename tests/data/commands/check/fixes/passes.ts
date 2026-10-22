import { ROOT_PACKAGE_WITHOUT_DEPENDENCIES } from '#tests/data/repository/dependency-files.ts';

// A check that fails while a file holds its first argument, and a correction that replaces that text with its second.
export const TEXT_CHECK_SCRIPT =
    'const [, text, ...paths] = process.argv; const bodies = await Promise.all(paths.map((path) => Bun.file(path).text())); process.exitCode = bodies.some((body) => body.includes(text)) ? 1 : 0;';

export const TEXT_FIX_SCRIPT =
    'const [, text, replacement, ...paths] = process.argv; for (const path of paths) await Bun.write(path, (await Bun.file(path).text()).replaceAll(text, replacement));';

export const FIX_LINTER_CASES = [
    {
        configuration: 'javascript',
        tool: 'eslint',
        executable: 'eslint.js',
        path: 'sample.js',
        config: 'native.mjs',
        nativeConfiguration: 'export default [{ rules: { semi: ["error", "always"], "no-undef": "error" } }];',
        invalidConfiguration: 'throw new Error("Invalid native configuration");',
        formatter: ['--format', 'json'],
        sample: 'missing()\n',
        partial: 'missing();\n',
        corrected: 'export {};\n',
    },
    {
        configuration: 'css',
        tool: 'stylelint',
        executable: 'stylelint.mjs',
        path: 'sample.css',
        config: 'native.json',
        nativeConfiguration: JSON.stringify({ rules: { 'color-hex-length': 'short', 'property-no-unknown': true } }),
        invalidConfiguration: '{',
        formatter: ['--formatter', 'unix'],
        sample: 'a { color: #ffffff; unknown: 1; }\n',
        partial: 'a { color: #fff; unknown: 1; }\n',
        corrected: 'a { color: #fff; }\n',
    },
] as const;

export const CLEAR_DEPENDENCIES_SCRIPT = `require('node:fs').writeFileSync('package.json', ${JSON.stringify(ROOT_PACKAGE_WITHOUT_DEPENDENCIES)})`;
/** The generated type files that a fix run keeps. */
export const GENERATED_TYPE_FILES = [
    'app/next-env.d.ts',
    'app/worker-configuration.d.ts',
    'next-env.d.ts',
    'worker-configuration.d.ts',
] as const;
