import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { CLI_BIN } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(['exception', 'rejection'])('an uncaught %s exits 2 with the command error envelope', async (kind) => {
    await using sandbox = await createGitSandbox({});
    for (const isVerbose of [false, true]) {
        const argumentsList = ['gspot', '--version', '--json', ...(isVerbose ? ['--verbose'] : [])];
        const failure =
            kind === 'exception'
                ? 'setImmediate(() => { throw new TypeError("Uncaught failure detail"); });'
                : 'void Promise.reject(new TypeError("Uncaught failure detail"));';
        const script = `
            process.argv = [process.execPath, ...${JSON.stringify(argumentsList)}];
            const write = process.stdout.write;
            process.stdout.write = () => true;
            await import(${JSON.stringify(pathToFileURL(CLI_BIN).href)});
            process.stdout.write = write;
            ${failure}
        `;
        const result = await runCommand([process.execPath, '--eval', script], { cwd: sandbox.path, env: {} });
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stderr).toBe('');
        const report: unknown = JSON.parse(result.stdout);
        expect(report).toMatchObject({
            version: cliPackage.version,
            exitCode: 2,
            notes: [],
            error: 'unexpected',
        });
        if (isVerbose) expect(report).toHaveProperty('stack');
        else expect(result.stdout).not.toContain('Uncaught failure detail');
    }
});
