import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { run, runProcess } from '#tests/support/cli/command.ts';
import { cpSync, chmodSync, mkdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

const MODULES = join(import.meta.dir, '../../../../node_modules');

test(
    'gspot executes its isolated formatter instead of the project formatter and corrects its finding',
    async () => {
        await using repository = await testdir();
        const projectTool = '#!/bin/sh\necho "project formatter must remain separate" >&2\nexit 2\n';
        await createFileTree(repository.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\nkits = ["formatting"]\n[guides]\ninstall = false\n',
            'source.js': 'export const greeting="hello";',
            'node_modules/prettier/package.json': '{"name":"prettier","version":"3.8.1"}\n',
            'node_modules/prettier/cli': projectTool,
        });
        chmodSync(join(repository.path, 'node_modules/prettier/cli'), 0o755);
        mkdirSync(join(repository.path, 'node_modules/.bin'));
        symlinkSync('../prettier/cli', join(repository.path, 'node_modules/.bin/prettier'));
        mkdirSync(join(repository.path, '.gspot/node_modules/.bin'), { recursive: true });
        cpSync(join(MODULES, 'prettier'), join(repository.path, '.gspot/node_modules/prettier'), {
            recursive: true,
            dereference: true,
        });
        symlinkSync('../prettier/bin/prettier.cjs', join(repository.path, '.gspot/node_modules/.bin/prettier'));
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const args = ['check', '--only', 'formatting/prettier', '--no-cache', '--json'];
        const finding = await run(repository.path, [...args, '--', 'source.js']);
        expect(finding.code, finding.stdout + finding.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(finding.stdout)).checks[0]).toMatchObject({
            check: 'formatting/prettier',
            status: 'fail',
            files: 1,
        });
        expect(reportSchema.parse(JSON.parse(finding.stdout)).checks[0]!.findings).toHaveLength(1);
        const corrected = await run(repository.path, [...args, '--fix', '--', 'source.js']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks[0]).toMatchObject({
            status: 'ok',
            findings: [],
        });
        expect(readFileSync(join(repository.path, 'source.js'), 'utf8')).toBe("export const greeting = 'hello';\n");
        expect(readFileSync(join(repository.path, 'node_modules/prettier/cli'), 'utf8')).toBe(projectTool);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'the project TypeScript compiler remains authoritative when managed dependencies expose another tsc',
    async () => {
        await using repository = await testdir();
        const managed = `#!${process.execPath}\nconsole.log('Version 99.0.0');\nprocess.exit(7);\n`;
        await createFileTree(repository.path, {
            '.gspot/node_modules/.bin/tsc': managed,
            'source.ts': 'export const port: number = "wrong";\n',
        });
        chmodSync(join(repository.path, '.gspot/node_modules/.bin/tsc'), 0o755);
        mkdirSync(join(repository.path, 'node_modules/.bin'), { recursive: true });
        symlinkSync(join(MODULES, 'typescript/bin/tsc'), join(repository.path, 'node_modules/.bin/tsc'));
        const tool = kitManifests()
            .get('typescript')!
            .tools.find((entry) => entry.name === 'tsc')!;
        const inspection = inspectTool({ root: repository.path, inspections: new Map() }, tool);
        expect(inspection.state).toBe('host');
        expect(inspection.found).toMatch(/^\d+\.\d+\.\d+/u);
        const command = [inspection.path!, '--pretty', 'false', '--noEmit', '--strict', 'source.ts'];
        const invalid = await runProcess(command, { cwd: repository.path });
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
        expect(invalid.stdout).toContain('TS2322');
        writeFileSync(join(repository.path, 'source.ts'), 'export const port: number = 8080;\n');
        const corrected = await runProcess(command, { cwd: repository.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(readFileSync(join(repository.path, '.gspot/node_modules/.bin/tsc'), 'utf8')).toBe(managed);
    },
    PLANTED_TIMEOUT_MS,
);
