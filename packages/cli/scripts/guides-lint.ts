// Lints the guides: structure, sections, and links. The examples are checked by their own tests.
import { fileURLToPath } from 'node:url';
import { globPaths } from '#cli/platform/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { lintRules, isRulePath } from '#cli/agents/lint.ts';

const rulesFolder = fileURLToPath(new URL('../guides/', import.meta.url));
const files = globPaths(rulesFolder, '**/*.md')
    .filter((path) => isRulePath(path))
    .toSorted((a, b) => a.localeCompare(b))
    .map((path) => ({ path, text: readSource(rulesFolder, path).toString('utf8') }));
const report = lintRules(files);
for (const finding of report.findings)
    process.stdout.write(`rules/${finding.file}:${String(finding.line)}: ${finding.message}\n`);
process.exitCode = report.findings.length > 0 ? 1 : 0;
