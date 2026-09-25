import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { emitTarget, templateInputs } from '#cli/generation/templates.ts';

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
        await Bun.write(
            source,
            '// Copyright 2026 Example Contributors.\n\nimport Foundation\n\nfunc greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n',
        );
        const session = await openSession(process.cwd());
        const config = join(staging, 'shipped.swiftformat');
        await Bun.write(
            config,
            emitTarget(
                'packages/cli/configurations/language/swift/swiftformat.tmpl',
                '.gspot/config/swiftformat',
                templateInputs(
                    session.root,
                    session.policyFiles.policy,
                    session.repository.files,
                    session.scopes,
                    session.scopes[0]!,
                    session.version,
                ),
            ),
        );
        const configured = await run([destination, '--lint', '--config', config, source], { cwd: staging });
        process.stdout.write(
            `SwiftFormat shipped config: exit ${String(configured.code)}\n${configured.stdout}${configured.stderr}`,
        );
        if (configured.code !== 0) throw new Error('SwiftFormat formatting smoke checks failed.');
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
}

if (process.argv.length !== 2) throw new Error('This setup script takes no arguments.');
if (process.platform !== 'win32') throw new Error('This setup script requires Windows.');
await installSwiftFormat();
