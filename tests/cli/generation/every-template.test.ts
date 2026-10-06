// Every template of every configuration renders at both levels into a file its reader parses.
import ts from 'typescript';
import { test, expect } from 'bun:test';
import { join, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { PROJECT_FILES } from '#tests/config/cli/generation/every-template.ts';

const PARSERS: Record<string, (text: string, path: string) => void> = {
    '.json': (text) => void JSON.parse(text),
    '.jsonc': parseJson,
    '.webmanifest': (text) => void JSON.parse(text),
    '.toml': (text) => {
        parseToml(text);
    },
    '.yml': (text) => void parseYaml(text),
    '.yaml': (text) => void parseYaml(text),
    '.mjs': parseModule,
    '.cjs': parseModule,
    '.js': parseModule,
    '.ts': parseModule,
};

function parseJson(text: string, path: string): void {
    const errors: ParseError[] = [];
    parseJsonc(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`${path}: JSON error at offset ${String(errors[0]!.offset)}`);
}

function parseModule(text: string, path: string): void {
    const result = ts.transpileModule(text, { reportDiagnostics: true, fileName: path });
    const errors = (result.diagnostics ?? []).map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
    if (errors.length > 0) throw new Error(`${path}: ${errors.join('; ')}`);
}

const configurations = [...configurationManifests().values()]
    .filter((manifest) => manifest.configs.some((config) => !config.fragment))
    .map((manifest) => manifest.configuration.name);

test.each(['recommended', 'all'])(
    'every configuration renders files their readers parse at level %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PROJECT_FILES,
            'gspot.toml': `level = "${level}"\nconfigurations = ${JSON.stringify(configurations)}\n`,
        });
        linkInstalledModules(join(sandbox.path, 'node_modules'));
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const generated = output.files.filter((file) => file.kind === 'config' || file.kind === 'pointer');
        const selected = new Set(
            session.scopes
                .flatMap((scope) => scope.selected)
                .filter((manifest) => configurations.includes(manifest.configuration.name))
                .map((manifest) => manifest.configuration.name),
        );
        expect(selected).toStrictEqual(new Set(configurations));
        expect(generated.length).toBeGreaterThan(configurations.length);
        for (const file of generated) {
            const parser = PARSERS[extname(file.path)];
            if (parser !== undefined) parser(file.content, file.path);
        }
    },
);
