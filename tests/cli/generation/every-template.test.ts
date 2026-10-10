// Every template of every configuration renders at both levels into a file its reader parses.
import ts from 'typescript';
import { test, expect } from 'bun:test';
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { join, extname, basename } from 'node:path';
import { openSession } from '#cli/commands/public.ts';
import { targetInScope } from '#cli/configurations/contracts.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import { configurationManifests } from '#cli/configurations/public.ts';
import { configuredChecks, requiredToolNames } from '#cli/planning/public.ts';
import { PROJECT_FILES, PLAIN_TOOL_FILES } from '#tests/config/cli/generation/every-template.ts';

const PARSERS: Record<string, (text: string, path: string) => void> = {
    '.cfg': (text) => {
        parseIni(text);
    },
    '.ini': (text) => {
        parseIni(text);
    },
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
    .filter((manifest) => manifest.toolFiles.some((config) => !config.fragment))
    .map((manifest) => manifest.configuration.name);

test.each(['recommended', 'all'])(
    'every configuration renders files their readers parse at level %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...PROJECT_FILES,
            'gspot.toml': `level = "${level}"\nconfigurations = ${JSON.stringify(configurations)}\n`,
        });
        await linkInstalledModules(join(sandbox.path, 'node_modules'));
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const generated = output.files.filter((file) => file.kind === 'tool_file' || file.kind === 'pointer');
        const selected = new Set(
            session.scopes
                .flatMap((scope) => scope.selected)
                .filter((manifest) => configurations.includes(manifest.configuration.name))
                .map((manifest) => manifest.configuration.name),
        );
        expect(selected).toStrictEqual(new Set(configurations));
        const paths = new Set(generated.map((file) => file.path));
        const checks = configuredChecks(session, true);
        const checkNames = new Set(checks.map((entry) => entry.check.name));
        const tools = new Set(checks.flatMap((entry) => requiredToolNames(entry, session)));
        for (const { scope, selected: manifests } of session.scopes) {
            const targets = manifests
                .flatMap((manifest) => manifest.toolFiles)
                .filter((file) => !file.fragment)
                .filter((file) => file.tool.length === 0 || file.tool.some((name) => tools.has(name)))
                .filter((file) => file.check.length === 0 || file.check.some((name) => checkNames.has(name)))
                .map((file) => targetInScope(scope.path, file));
            expect(targets.length).toBeGreaterThan(0);
            expect(new Set(targets).difference(paths)).toStrictEqual(new Set<string>());
        }
        expect(paths).not.toContain('.gspot/config/jsconfig.json');
        if (level === 'recommended') {
            expect(paths).not.toContain('.gspot/config/commitlint.config.cjs');
            expect(paths).not.toContain('.gspot/config/jscpd.json');
        }
        for (const file of generated) {
            if (PLAIN_TOOL_FILES.includes(basename(file.path))) continue;
            const parser = PARSERS[extname(file.path)];
            if (parser === undefined) throw new Error(`${file.path}: no generated-file parser is declared.`);
            parser(file.content, file.path);
        }
    },
);
