// The rule lint of this repository, run as the [[check]] rules/lint: every rule file under rules/ against the rule requirements.

import { globby } from 'globby';
import { readSource } from '#cli/repository/tracked.ts';
// Usage: bun packages/cli/scripts/check-rule-guides.ts
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isRulePath, lintRules } from '#cli/agents/lint.ts';

const here = dirname(fileURLToPath(new URL(import.meta.url)));
const root = join(here, '..', '..', '..');
const rulesFolder = join(root, 'packages/cli/rules');

const paths = await globby(['**/*.md'], { cwd: rulesFolder });
const files = paths
    .filter((path) => isRulePath(path))
    .toSorted((a, b) => a.localeCompare(b))
    .map((path) => ({ path, text: readSource(rulesFolder, path).toString('utf8') }));
const report = lintRules(files);
for (const finding of report.findings) console.log(`rules/${finding.file}:${String(finding.line)}: ${finding.message}`);
process.exitCode = report.findings.length > 0 ? 1 : 0;
