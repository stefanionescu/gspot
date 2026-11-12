import { expect, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { buildProgram } from '#cli/main.ts';
import { readCliReference } from '#cli/reference.ts';

test('the reference lists every command of the program with its usage line', () => {
    const { commands } = readCliReference();
    const names = buildProgram(() => {}, process.cwd()).commands.map((command) => command.name());
    expect(commands.map(({ name }) => name)).toStrictEqual(names);
    expect(commands.map(({ usage }) => usage.split(' ').slice(0, 2).join(' '))).toStrictEqual(
        names.map((name) => `gspot ${name}`),
    );
});

test('the reference gives each Swift rule file the files that select it', () => {
    const swift = readCliReference().configurations.find(({ name }) => name === 'swift');
    expect(swift?.ruleFiles).toStrictEqual([
        {
            path: '.gspot/rules/SWIFT-TESTS.md',
            conditions: ['a Swift test file', 'a `Package.swift` with a test target'],
            exclusions: [],
        },
        { path: '.gspot/rules/SWIFT.md', conditions: [], exclusions: [] },
        { path: '.gspot/rules/SWIFTUI.md', conditions: ['a Swift file that imports `SwiftUI`'], exclusions: [] },
        { path: '.gspot/rules/UIKIT.md', conditions: ['a Swift file that imports `UIKit`'], exclusions: [] },
    ]);
});

test('the reference holds one setup entry per package manager with its install and init commands', () => {
    const { name } = cliPackage;
    const lines = Object.fromEntries(readCliReference().setup.map((entry) => [entry.name, entry.lines]));
    expect(lines).toStrictEqual({
        bun: [`bun add --dev --exact ${name}`, 'bunx --no-install gspot init'],
        npm: [`npm install --save-dev --save-exact ${name}`, 'npm exec --no -- gspot init'],
        pnpm: [`pnpm add --save-dev --save-exact ${name}`, 'pnpm exec gspot init'],
        yarn: [`yarn add --dev --exact ${name}`, 'yarn exec -- gspot init'],
        mise: [
            'mise use --pin node@24',
            `mise use --pin --tool-option allow_low_downloads=true npm:${name}`,
            'mise exec -- gspot init',
        ],
    });
});
