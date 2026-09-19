// ruby/bundler-audit: Gemfile.lock against the Ruby advisory database, read from the JSON bundler-audit prints.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import type { AuditedGem, AuditedGems, GemAdvisory } from '#types/bundler.ts';

const LOCKFILE = 'Gemfile.lock';
const COMMAND_TIMEOUT_MS = 600_000;

function inScope(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

function sourceFinding(input: EngineInput, source: string): Finding {
    const text = `The source ${source} is read over plain HTTP.`;
    return {
        check: input.spec.id,
        file: inScope(input, LOCKFILE),
        line: 1,
        rule: 'insecure-source',
        message: text,
        fixable: false,
    };
}

function advisoryFinding(input: EngineInput, gem: AuditedGem, advisory: GemAdvisory): Finding {
    const patched = (advisory.patched_versions ?? []).join(', ');
    const remedy = patched === '' ? 'No patched version exists yet.' : `Patched in ${patched}.`;
    const text = `${gem.name} ${gem.version}: ${advisory.title}. ${remedy}`;
    return {
        check: input.spec.id,
        file: inScope(input, LOCKFILE),
        line: 1,
        rule: advisory.id,
        message: text,
        fixable: false,
    };
}

function findingsOf(input: EngineInput, entry: AuditedGems['results'][number]): Finding[] {
    if (entry.source !== undefined) return [sourceFinding(input, entry.source)];
    const { gem, advisory } = entry;
    if (gem === undefined || advisory === undefined) return [];
    return [advisoryFinding(input, gem, advisory)];
}

/**
 * One finding for each advisory that names a gem version in Gemfile.lock, and for each gem source over plain HTTP.
 * @param input the engine input
 * @returns the findings
 */
export async function rubyAdvisories(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, LOCKFILE))) return [];
    const result = await run(['bundler-audit', 'check', '--update', '--format', 'json'], {
        cwd,
        timeoutMs: COMMAND_TIMEOUT_MS,
    });
    if (result.missing) throw new MissingToolError('The bundler-audit command is not installed.');
    const start = result.stdout.indexOf('{');
    if (start === -1)
        throw new Error(`The bundler-audit command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const report = JSON.parse(result.stdout.slice(start)) as AuditedGems;
    return report.results.flatMap((entry) => findingsOf(input, entry));
}
