import { expect, test } from 'bun:test';

import { buildProgram } from '#cli/main.ts';
import { CLI_REFERENCE } from '#cli/reference.ts';

test('the reference lists every command of the program with its usage line', () => {
    const { commands } = CLI_REFERENCE;
    const names = buildProgram(async () => {}).commands.map((command) => command.name());
    expect(commands.map(({ name }) => name)).toStrictEqual(names);
    expect(commands.map(({ usage }) => usage.split(' ').slice(0, 2).join(' '))).toStrictEqual(
        names.map((name) => `gspot ${name}`),
    );
});

test('the reference gives each Swift rule file the files that select it', () => {
    const swift = CLI_REFERENCE.configurations.find(({ name }) => name === 'swift');
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
