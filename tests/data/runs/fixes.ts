import { TYPO } from '#tests/data/checks/spelling.ts';

/** Tool fixes that leave one finding for the second fix pass and a manual fix. */
export const PARTIAL_FIX_CASES = [
    {
        configuration: 'sql',
        check: 'sql/sqlfluff',
        path: 'sample.sql',
        tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
        sample: 'select  * from foo;\n',
        partial: 'SELECT * FROM foo;\n',
        corrected: 'SELECT id FROM foo;\n',
    },
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: 'sample.txt',
        tables: '',
        sample: `${TYPO.the} ${TYPO.whether}\n`,
        partial: `the ${TYPO.whether}\n`,
        corrected: 'the whether\n',
    },
] as const;

/** Each fixer result: its exit code and the file bytes it leaves. */
export const FIXER_RESULTS = [
    {
        name: 'finding exit with original bytes',
        script: 'await Bun.write(\'source.txt\', "original"); process.exitCode = 3',
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
    },
    {
        name: 'finding exit with corrected bytes',
        script: 'await Bun.write(\'source.txt\', "corrected"); process.exitCode = 3',
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
    },
    {
        name: 'undeclared exit with partial bytes',
        script: 'await Bun.write(\'source.txt\', "partial"); process.exitCode = 4',
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'exited 4',
    },
    {
        name: 'default exit with original bytes',
        script: 'process.exitCode = 0',
        exit_codes: undefined,
        status: 'unchanged',
        after: 'original',
    },
    {
        name: 'default failure with original bytes',
        script: 'process.exitCode = 3',
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'exited 3',
    },
] as const;

// A check that fails while a file holds its first argument, and a correction that replaces that text with its second.
export const TEXT_CHECK =
    'const [, text, ...paths] = process.argv; const bodies = await Promise.all(paths.map((path) => Bun.file(path).text())); process.exitCode = bodies.some((body) => body.includes(text)) ? 1 : 0;';

export const TEXT_FIX =
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
