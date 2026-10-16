import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import example from '#docs/src/config/example.json';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { stat, readdir, readFile } from 'node:fs/promises';
import packageManifest from '#cli-package' with { type: 'json' };
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { NPM_BADGE_PATH, DOC_EXAMPLE_PATHS } from '#tests/data/rules.ts';

/** List the authored Markdown sources checked by both documentation example tests. */
async function documentationFiles(): Promise<string[]> {
    const files: string[] = [];
    for (const path of DOC_EXAMPLE_PATHS) {
        const entry = await stat(path);
        if (!entry.isDirectory()) {
            files.push(path);
            continue;
        }
        const entries = await readdir(path, { recursive: true });
        files.push(...entries.filter((file) => /\.mdx?$/u.test(file)).map((file) => join(path, file)));
    }
    return files;
}

/** Check TOML fences that name gspot.toml or start with a settings key. */
function settingsExampleViolations(text: string): string[] {
    return [...text.matchAll(/```toml([^\n]*)\n([\s\S]*?)\n```/gu)].flatMap((match) => {
        const language = match[1] ?? '';
        const content = match[2]!;
        if (
            !language.includes('gspot.toml') &&
            !/^(?:configurations|level|tool_timeout_seconds|\[(?:rules|hooks|tools|limits|scope|ignore|architecture|naming|command_check))/mu.test(
                content,
            )
        )
            return [];
        const result = settingsSchema.safeParse(parse(content));
        return result.success ? [] : [result.error.message];
    });
}

/** Read command lines from shell fences, including continued shell lines. */
function documentedCommands(text: string): string[] {
    return [...text.matchAll(/```(?:shell|bash|sh|console)[^\n]*\n([\s\S]*?)\n```/gu)].flatMap((block) =>
        [...block[1]!.replaceAll(/\\\n\s*/gu, ' ').matchAll(/\bgspot ([^\n]+)/gu)].map((match) => match[1]!),
    );
}

/** Place help before a shell operand separator and omit a trailing shell comment. */
function commandHelpArguments(command: string): string[] {
    const commandArguments = (command.match(/"(?:\\.|[^"])*"|'[^']*'|[^\s]+/gu) ?? []).map((part) =>
        /^['"]/u.test(part) ? part.slice(1, -1) : part,
    );
    const comment = commandArguments.indexOf('#');
    return (comment === -1 ? commandArguments : commandArguments.slice(0, comment)).toSpliced(1, 0, '--help');
}

test('the documentation and home page gspot.toml examples satisfy the settings schema', async () => {
    const violations: string[] = [];
    for (const path of await documentationFiles()) {
        const text = await readFile(path, 'utf8');
        violations.push(...settingsExampleViolations(text).map((message) => `${path}: ${message}`));
    }
    for (const file of [...example.project, ...example.agent.files, ...example.fix.files].filter(({ path }) =>
        path.endsWith('gspot.toml'),
    )) {
        const result = settingsSchema.safeParse(parse(file.content));
        if (!result.success) violations.push(`Home page ${file.path}: ${result.error.message}`);
    }
    expect(violations).toStrictEqual([]);
});

/** Combine authored shell examples with the setup commands used by the home page. */
async function documentationCommands(): Promise<Set<string>> {
    const commands = new Set<string>();
    for (const path of await documentationFiles()) {
        const text = await readFile(path, 'utf8');
        for (const command of documentedCommands(text)) commands.add(command);
    }
    for (const command of Object.values(example.commands)) {
        const match = /\bgspot (.+)/u.exec(command);
        if (match !== null) commands.add(match[1]!);
    }
    return commands;
}

test('each gspot command shown in the documentation accepts its arguments with --help', async () => {
    await using sandbox = await testdir();
    const violations: string[] = [];
    for (const command of await documentationCommands()) {
        const result = await runGspot(sandbox.path, commandHelpArguments(command));
        if (result.code !== 0) violations.push(`${command}: ${result.stderr}`);
    }
    expect(violations).toStrictEqual([]);
});

test('the README npm badge shows the version of the CLI package', async () => {
    const badge = await readFile(NPM_BADGE_PATH, 'utf8');
    const { version } = packageManifest;
    expect([...badge.matchAll(/npm: ([^<"]+)/gu)].map((match) => match[1])).toStrictEqual([version, version]);
    expect(badge).toContain(`>${version}</text>`);
});
