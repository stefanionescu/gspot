import { join } from 'node:path';
import { expect, test } from 'bun:test';
import {
    chmodSync,
    statSync,
    writeFileSync,
    readFileSync,
    symlinkSync,
    mkdirSync,
    readdirSync,
    unlinkSync,
    existsSync,
} from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/harness/planted.ts';
import type { RunReport } from '#types/report.ts';

test.skipIf(process.platform === 'win32')(
    'a read-only report directory preserves CLI findings and verdict',
    async () => {
        const command = [process.execPath, '-e', "console.log('Retained CLI finding'); process.exitCode = 1"];
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'source.txt': 'original',
            '.gspot/sentinel': 'keep',
            'gspot.toml': `version = 1
presets = []
[[check]]
name = "sandbox/storage"
command = ${JSON.stringify(command)}
paths = ["source.txt"]
stage = "commit"
[check.output]
format = "lines"
`,
        });
        const directory = join(sandbox.path, '.gspot');
        const mode = statSync(directory).mode & 0o777;
        chmodSync(directory, 0o500);
        try {
            const result = await run(sandbox.path, ['check', '--json', '--no-cache']);
            expect(result.code).toBe(1);
            const report = JSON.parse(result.stdout) as RunReport;
            expect(report.checks[0]?.findings[0]?.message).toBe('Retained CLI finding');
            expect(report.exitCode).toBe(1);
            expect(result.stderr).toContain('report.json');
            expect(result.stderr.trim().split('\n')).toHaveLength(1);
        } finally {
            chmodSync(directory, mode);
        }
    },
);

test.each(['directory', 'report', 'cache'])(
    'runtime storage refuses a symbolic-link %s without changing outside bytes',
    async (target) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\npresets = []\n[[check]]\nname = "project/storage"\npaths = ["source.txt"]\ninputs = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'console.log("Exact finding"); process.exitCode=1'])}\n[check.output]\nformat = "lines"\n`,
            'source.txt': 'input\n',
        });
        writeFileSync(join(outside.path, 'sentinel'), 'authored outside\n');
        if (target === 'directory') symlinkSync(outside.path, join(sandbox.path, '.gspot'));
        else {
            mkdirSync(join(sandbox.path, '.gspot'));
            symlinkSync(
                target === 'report' ? join(outside.path, 'sentinel') : outside.path,
                join(sandbox.path, '.gspot', target === 'report' ? 'report.json' : 'cache'),
            );
        }
        const result = await run(sandbox.path, ['check', '--json', ...(target === 'cache' ? [] : ['--no-cache'])]);
        if (target === 'directory') {
            expect(result.code, result.stdout + result.stderr).toBe(2);
            expect(result.stderr).toContain('Open parent directory');
        } else {
            expect(result.code, result.stdout + result.stderr).toBe(1);
            expect((JSON.parse(result.stdout) as RunReport).checks[0]?.findings[0]?.message).toBe('Exact finding');
            expect(result.stderr).toContain('Could not write');
        }
        expect(readFileSync(join(outside.path, 'sentinel'), 'utf8')).toBe('authored outside\n');
        expect(readdirSync(outside.path)).toEqual(['sentinel']);
    },
);

test('runtime ownership preserves authored reports and edited cache results through apply and uninstall', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\npresets = []\n[rules]\ninstall = false\n[[check]]\nname = "project/storage"\npaths = ["source.txt"]\ninputs = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode=0'])}\n`,
        'source.txt': 'input\n',
        '.gspot/report.json': 'authored report\n',
    });
    const command = ['check', '--json'];
    const initial = await run(sandbox.path, command);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(initial.stderr).toContain('Preserved edited or unowned report');
    expect(readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8')).toBe('authored report\n');
    unlinkSync(join(sandbox.path, '.gspot/report.json'));
    const cached = await run(sandbox.path, command);
    expect(cached.code, cached.stdout + cached.stderr).toBe(0);
    expect((JSON.parse(cached.stdout) as RunReport).checks[0]?.status).toBe('cache');
    const cache = join(sandbox.path, '.gspot/cache', readdirSync(join(sandbox.path, '.gspot/cache'))[0]!);
    const edited = 'edited cache result\n';
    writeFileSync(cache, edited);
    const repeated = await run(sandbox.path, command);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as RunReport).checks[0]?.status).toBe('ok');
    expect(readFileSync(cache, 'utf8')).toBe(edited);
    const report = readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8');
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8')).toBe(report);
    const removed = await run(sandbox.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, '.gspot/report.json'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot/report.sarif'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot/report.codequality.json'))).toBe(false);
    expect(readFileSync(cache, 'utf8')).toBe(edited);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('input\n');
});

test.each(['before', 'after'])('an interrupted report %s publication recovers on the next check', async (point) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\npresets = []\n[[check]]\nname = "project/storage"\npaths = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode=(await Bun.file("source.txt").text()) === "corrected\\n" ? 0 : 1'])}\n`,
        'source.txt': 'defect\n',
    });
    const first = await run(sandbox.path, ['check', '--json']);
    expect(first.code, first.stdout + first.stderr).toBe(1);
    const previous = readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8');
    writeFileSync(join(sandbox.path, 'source.txt'), 'corrected\n');
    const boundary = join(import.meta.dir, '../../../packages/cli/src/lifecycle/confined.ts');
    const cli = join(import.meta.dir, '../../../packages/cli/src/main.ts');
    const program = `
import { mock } from 'bun:test';
const boundary=await import(${JSON.stringify(boundary)});
const open=boundary.openConfinedRoot;
mock.module(${JSON.stringify(boundary)},()=>({...boundary,openConfinedRoot(root){
const files=open(root);
return {...files,write(path,value,expected){
if(path==='.gspot/report.json' && ${JSON.stringify(point)}==='before') process.exit(73);
files.write(path,value,expected);
if(path==='.gspot/report.json' && ${JSON.stringify(point)}==='after') process.exit(73);
}};
}}));
process.argv=[process.execPath,${JSON.stringify(cli)},'check','--json'];
await import(${JSON.stringify(cli)});
`;
    const child = Bun.spawn([process.execPath, '-e', program], { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' });
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    expect(await child.exited, (await output) + (await errors)).toBe(73);
    const published = readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8');
    if (point === 'before') expect(published).toBe(previous);
    else expect((JSON.parse(published) as RunReport).exitCode).toBe(0);
    const pending = JSON.parse(readFileSync(join(sandbox.path, '.gspot/ownership.json'), 'utf8'));
    expect(pending.pending[0].path).toBe('.gspot/report.json');
    const retry = await run(sandbox.path, ['check', '--json']);
    expect(retry.code, retry.stdout + retry.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(sandbox.path, '.gspot/report.json'), 'utf8'))).toEqual(
        JSON.parse(retry.stdout),
    );
    expect(JSON.parse(readFileSync(join(sandbox.path, '.gspot/ownership.json'), 'utf8')).pending).toBeUndefined();
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected\n');
});

test('GitLab reports retain located findings, stable fingerprints, and corrections alongside complete JSON and SARIF', async () => {
    await using sandbox = await testdir();
    const source = "script's file.sh";
    const inspect = `if((await Bun.file(${JSON.stringify(source)}).text()).includes('if then')) { console.log('Repository finding without a location.'); process.exitCode=1; }`;
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\npresets = ["bash"]\n[rules]\ninstall = false\n[[check]]\nname = "project/global"\npaths = ["*.sh"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', inspect])}\n[check.output]\nformat = "lines"\n`,
        [source]: 'if then\n',
    });
    const command = ['check', '--only', 'bash/syntax', 'project/global', '--json', '--no-cache'];
    const first = await run(sandbox.path, command);
    expect(first.code, first.stdout + first.stderr).toBe(1);
    const report = JSON.parse(first.stdout) as RunReport;
    const findings = report.checks.flatMap((check) => check.findings);
    expect(findings.find((finding) => finding.file === '')?.message).toBe('Repository finding without a location.');
    const path = join(sandbox.path, '.gspot/report.codequality.json');
    const quality = JSON.parse(readFileSync(path, 'utf8')) as {
        description: string;
        check_name: string;
        fingerprint: string;
        severity: string;
        location: { path: string; lines: { begin: number } };
    }[];
    expect(quality).toHaveLength(2);
    expect(
        JSON.parse(readFileSync(join(sandbox.path, '.gspot/report.sarif'), 'utf8')).runs[0].invocations[0]
            .executionSuccessful,
    ).toBe(true);
    expect(quality.map(({ fingerprint, ...entry }) => entry)).toEqual(
        findings
            .filter((finding) => finding.file !== '')
            .map((finding) => ({
                description: finding.message,
                check_name: finding.rule === undefined ? finding.check : `${finding.check}:${finding.rule}`,
                severity: 'major',
                location: { path: source, lines: { begin: Math.max(1, finding.line ?? 1) } },
            })),
    );
    for (const entry of quality) expect(entry.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(readFileSync(join(sandbox.path, '.gspot/report.sarif'), 'utf8')).toContain(
        'Repository finding without a location.',
    );
    const repeated = await run(sandbox.path, command);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(quality);
    writeFileSync(join(sandbox.path, source), 'echo corrected\n');
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual([]);
});

test('SARIF identifies missing execution separately from a completed scan with no findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\npresets = []\n[[check]]\nname = "project/missing"\npaths = ["source.txt"]\nstage = "commit"\ncommand = ["gspot-test-unavailable-executable"]\n',
        'source.txt': 'input\n',
    });
    const checked = await run(sandbox.path, ['check', '--json', '--no-cache']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks[0]?.status).toBe('missing');
    const sarif = JSON.parse(readFileSync(join(sandbox.path, '.gspot/report.sarif'), 'utf8'));
    expect(sarif.runs[0].results).toEqual([]);
    expect(sarif.runs[0].invocations[0].executionSuccessful).toBe(false);
    expect(sarif.runs[0].invocations[0].toolExecutionNotifications[0].message.text).toContain('project/missing');
});
