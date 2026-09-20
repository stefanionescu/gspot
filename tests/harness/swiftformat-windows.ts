import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '#cli/platform/spawn.ts';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';

async function output(command: string[]): Promise<string> {
    const result = await run(command, { cwd: process.cwd() });
    if (result.code !== 0)
        throw new Error(`Tool setup failed (exit ${String(result.code)}): ${result.stderr}${result.stdout}`);
    return result.stdout.trim();
}

async function installSwiftFormat(): Promise<void> {
    const version = await output(['mise', 'current', 'swiftformat']);
    const installation = await output(['mise', 'where', 'swiftformat']);
    const staging = mkdtempSync(join(tmpdir(), 'gspot-swiftformat-'));
    try {
        const installer = join(staging, 'SwiftFormat.amd64.msi');
        const extracted = join(staging, 'extracted');
        const response = await fetch(
            `https://github.com/nicklockwood/SwiftFormat/releases/download/${version}/SwiftFormat.amd64.msi`,
        );
        if (!response.ok) throw new Error(`SwiftFormat download failed with HTTP ${String(response.status)}.`);
        await Bun.write(installer, response);
        await output(['msiexec.exe', '/a', installer, '/qn', `TARGETDIR=${extracted}`]);
        const executables = [...new Bun.Glob('**/swiftformat.exe').scanSync({ cwd: extracted, onlyFiles: true })];
        if (executables.length !== 1) throw new Error('The SwiftFormat package must contain one executable.');
        const destination = join(installation, 'swiftformat.exe');
        copyFileSync(join(extracted, executables[0]!), destination);
        process.stdout.write(`${await output([destination, '--version'])}\n`);
        const source = join(staging, 'smoke.swift');
        await Bun.write(source, 'let value = 1\n');
        await output([destination, '--lint', '--verbose', '--cache', 'ignore', source]);
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
}

if (process.argv.length !== 2) throw new Error('This setup script takes no arguments.');
if (process.platform !== 'win32') throw new Error('This setup script requires Windows.');
await installSwiftFormat();
