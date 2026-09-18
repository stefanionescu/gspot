// Writes an enforcement marker on every rule statement in rules/ from enforcement-map.json; --check reports what is missing.
// Usage: bun packages/cli/scripts/mark-statements.ts [--check]
import { join } from 'node:path';
import { isRulePath } from '#cli/rules/lint.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { CHECK_IDS } from '#config/architecture-ids.ts';
import type { EnforcementMapping, MarkerCounts } from '#types/rules.ts';
import { assetPath, listAssets, readAsset } from '#cli/platform/assets.ts';
import { countMarkers, markedLines, markerFindings, statementsOf } from '#cli/rules/markers.ts';

const here = new URL('.', import.meta.url).pathname;
const rulesDirectory = join(here, '..', '..', '..', 'rules');
const isCheck = process.argv.includes('--check');
const PERCENT = 100;
const JSON_INDENT = 4;
const RULES_PREFIX = 'rules/';

const mappings = JSON.parse(readFileSync(join(rulesDirectory, 'enforcement-map.json'), 'utf8')) as EnforcementMapping[];
const compiled = mappings.map((mapping) => ({
    isFile: pathMatcher([mapping.files]),
    pattern: new RegExp(mapping.pattern, 'i'),
    check: mapping.check,
}));
const checkIds = new Set(CHECK_IDS);

function checkFor(path: string, statement: string): string | undefined {
    return compiled.find((mapping) => mapping.isFile(path) && mapping.pattern.test(statement))?.check;
}

const counts: Record<string, MarkerCounts> = {};
let problems = 0;
const rulePaths = listAssets(RULES_PREFIX)
    .map((asset) => asset.slice(RULES_PREFIX.length))
    .filter((path) => isRulePath(path) && !path.startsWith('templates/'));
for (const path of rulePaths) {
    const lines = readAsset(`${RULES_PREFIX}${path}`).split('\n');
    const statements = statementsOf(lines);
    if (isCheck) {
        const findings = markerFindings(path, statements, checkIds);
        for (const finding of findings)
            process.stdout.write(`${finding.file}:${String(finding.line)} ${finding.message}\n`);
        problems += findings.length;
        counts[path] = countMarkers(statements);
        continue;
    }
    const marked = markedLines(lines, (text) => checkFor(path, text));
    counts[path] = countMarkers(statementsOf(marked));
    const target = assetPath(`${RULES_PREFIX}${path}`);
    if (target !== undefined) writeFileSync(target, marked.join('\n'));
}

const total = Object.values(counts).reduce((sum, count) => sum + count.statements, 0);
const unenforced = Object.values(counts).reduce((sum, count) => sum + count.unenforced, 0);
writeFileSync(join(rulesDirectory, 'unenforced.json'), `${JSON.stringify(counts, null, JSON_INDENT)}\n`);
const percent = total === 0 ? 0 : Math.round((PERCENT * unenforced) / total);
process.stdout.write(`${String(total)} statements, ${String(unenforced)} unenforced (${String(percent)}%)\n`);
if (isCheck && problems > 0) {
    process.stdout.write(`${String(problems)} marker problems\n`);
    process.exitCode = 1;
}
