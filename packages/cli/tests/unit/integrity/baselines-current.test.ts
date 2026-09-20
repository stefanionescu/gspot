// The baselines-current analysis: a count baseline for a check that is gone, and a suppression for a file that is gone.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Policy } from '#types/config.ts';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { CheckSpec, Manifest } from '#types/manifest.ts';
import type { Repository, ScopeEntry } from '#types/repository.ts';
import { baselinesCurrent } from '#cli/integrity/baselines-current.ts';
import type { EngineInput, ScopeSelection, Session } from '#types/run.ts';

function input(root: string, checks: Partial<CheckSpec>[]): EngineInput {
    const files = [
        {
            path: 'src/kept.ts',
            prefix: Buffer.alloc(0),
            nature: 'source' as const,
            tags: ['text'],
            executable: false,
            size: 1,
        },
    ];
    const repository: Partial<Repository> = { files };
    const manifest: Partial<Manifest> = { checks: checks as CheckSpec[] };
    const entry: Partial<ScopeEntry> = { path: '' };
    const selection: Partial<ScopeSelection> = { scope: entry as ScopeEntry, selected: [manifest as Manifest] };
    const policy: Partial<Policy> = { checks: [] };
    const policyFiles: Partial<Session['policyFiles']> = { policy: policy as Policy };
    const partialSession: Partial<Session> = {
        repository: repository as Repository,
        scopes: [selection as ScopeSelection],
        policyFiles: policyFiles as Session['policyFiles'],
    };
    const spec: Partial<CheckSpec> = { name: 'integrity/baselines-current' };
    const partial: Partial<EngineInput> = {
        root,
        scope: '',
        spec: spec as CheckSpec,
        files,
        session: partialSession as Session,
    };
    return partial as EngineInput;
}

describe('baselines-current', () => {
    test('a baseline for a check that no longer runs and a suppression for a deleted file are reported', async () => {
        await using sandbox = await createSandbox({
            '.gspot/baselines/old.check.rule.json': JSON.stringify({
                check: 'old/check',
                rule: 'rule',
                count: 1,
                recorded: '2026-09-18',
                paths: { 'src/kept.ts': 1 },
            }),
            '.gspot/baselines/eslint.json': JSON.stringify({
                'src/kept.ts': { rule: { count: 1 } },
                'src/gone.ts': {},
            }),
        });
        mkdirSync(join(sandbox.path, 'src'), { recursive: true });
        const found = await baselinesCurrent(
            input(sandbox.path, [{ name: 'typescript/eslint', baseline_file: '.gspot/baselines/eslint.json' }]),
        );
        expect(found.map((finding) => [finding.rule, finding.message.split(' ', 1)[0]])).toEqual([
            ['unknown-check', 'The'],
            ['stale-suppression', 'src/gone.ts'],
        ]);
    });
});
