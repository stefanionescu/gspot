import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each([...LEVELS])('Vue optional props may remain absent at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['vue'], { level }),
        'Card.vue': '<script setup>defineProps({ label: String });</script>\n<template><p>{{ label }}</p></template>\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['Card.vue'], ['vue/require-default-prop'])).toStrictEqual([]);
});
