import { test, expect } from 'bun:test';
import { detectKits } from '#cli/kits/detect.ts';
import { testdir, createFileTree } from 'testdirs';
import { kitManifests } from '#cli/kits/manifests.ts';
import { readRepository } from '#cli/repository/tree.ts';

test.each([
    { source: 'import XCTest\n', selected: true },
    { source: '@Testing.Test func checks() {}\n', selected: true },
    { source: '// import Testing\nlet example = "@Test"\n', selected: false },
    { source: 'import TestingSupport\n', selected: false },
])('Swift test detection reads syntax: $source', async ({ source, selected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'Examples/Checks.swift': source });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(repository.files[0]!.tags.includes('swift-test')).toBe(selected);
    expect(detectKits(repository.files, kitManifests(), []).some(({ kit }) => kit === 'xctest')).toBe(selected);
});

test.each([true, false])('Swift package test targets are executable declarations: %s', async (declared) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'Package.swift': declared
            ? 'import PackageDescription\nlet package = Package(name: "App", targets: [.testTarget(name: "Checks")])\n'
            : '// .testTarget(name: "Checks")\nlet example = ".testTarget"\n',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    expect(detectKits(repository.files, kitManifests(), []).some(({ kit }) => kit === 'xctest')).toBe(declared);
});
