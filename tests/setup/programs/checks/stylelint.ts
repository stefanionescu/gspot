import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LinterResult } from 'stylelint';
import { STYLELINT_MODULE_PATH } from '#tests/config/setup/programs.ts';

const [stylesheet = ''] = process.argv.slice(2);
const stylelint = (await import(pathToFileURL(join(process.cwd(), STYLELINT_MODULE_PATH)).href)) as {
    default: { lint: (options: { files: string[]; cwd: string }) => Promise<LinterResult> };
};
const result = await stylelint.default.lint({ files: [stylesheet], cwd: process.cwd() });
const findings = result.results.flatMap(({ warnings, parseErrors, invalidOptionWarnings }) => [
    ...warnings.map(({ rule, line, column, severity }) => ({ rule, line, column, severity })),
    ...parseErrors,
    ...invalidOptionWarnings,
]);
process.stdout.write(JSON.stringify(findings));
