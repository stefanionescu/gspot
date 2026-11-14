import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { getShippedCheck } from '#tests/setup/cli/manifests.ts';

const LOCKFILE = 'version = 1\n\n[[package]]\nname = "pyjwt"\nversion = "2.10.1"\n';

function buildAdvisory(id: string, fixed: string[]) {
    return {
        id,
        summary: 'PyJWKClient follows redirects',
        affected: [
            {
                package: { name: 'PyJWT', ecosystem: 'PyPI' },
                ranges: [{ events: fixed.map((version) => ({ fixed: version })) }],
            },
            { package: { name: 'other', ecosystem: 'PyPI' }, ranges: [{ events: [{ fixed: '9.9.9' }] }] },
        ],
    };
}

async function readFindings(packageReport: object) {
    await using sandbox = await testdir({ 'uv.lock': LOCKFILE });
    const report = {
        results: [
            {
                source: { path: join(sandbox.path, 'uv.lock'), type: 'lockfile' },
                packages: [{ package: { name: 'pyjwt', version: '2.10.1', ecosystem: 'PyPI' }, ...packageReport }],
            },
        ],
    };
    const check = getShippedCheck('dependencies/osv-scanner');
    const findings = parseOutput(check, JSON.stringify(report), '', { root: sandbox.path, cwd: sandbox.path });
    return findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }));
}

test('one vulnerability with two advisory IDs is one finding that names both IDs and each fixed version', async () => {
    const findings = await readFindings({
        vulnerabilities: [
            buildAdvisory('PYSEC-2026-4144', ['2.12.0']),
            buildAdvisory('GHSA-2gx3-rcp4-g85q', ['2.12.0', '3.0.1']),
            buildAdvisory('GHSA-aaaa-bbbb-cccc', []),
        ],
        groups: [{ ids: ['PYSEC-2026-4144', 'GHSA-2gx3-rcp4-g85q'] }, { ids: ['GHSA-aaaa-bbbb-cccc'] }],
    });
    expect(findings).toStrictEqual([
        {
            file: 'uv.lock',
            line: 4,
            rule: 'PYSEC-2026-4144',
            message:
                'pyjwt@2.10.1: PyJWKClient follows redirects. Also listed as GHSA-2gx3-rcp4-g85q. Fixed in 2.12.0, 3.0.1.',
        },
        {
            file: 'uv.lock',
            line: 4,
            rule: 'GHSA-aaaa-bbbb-cccc',
            message: 'pyjwt@2.10.1: PyJWKClient follows redirects. The advisory names no fixed version.',
        },
    ]);
});

test('a report with no groups keeps one finding for each advisory', async () => {
    const findings = await readFindings({
        vulnerabilities: [buildAdvisory('GHSA-1', ['2.12.0']), buildAdvisory('GHSA-2', ['2.12.0'])],
    });
    expect(findings.map(({ rule }) => rule)).toStrictEqual(['GHSA-1', 'GHSA-2']);
});
