// A framework carries the naming rules of its own files in its manifest, and the repository's rules follow them (K-50).
import { test, expect } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import { configurationManifests } from '#cli/kits/manifests.ts';
import { exposedSettings } from '#cli/policy/setting-surface.ts';
import { rulesFor, effectivePolicy } from '#cli/checks/naming/policy.ts';

const manifests = configurationManifests();
const express = manifests.get('express')!;
test('a selected framework adds its rules after the shipped ones and before the repository rules', () => {
    const text =
        'version = 1\nconfigurations = ["typescript", "express"]\n[[naming.rules]]\npaths = ["src/hooks/**"]\ncategories = ["functions"]\nstructural_prefix = "^use(?=[A-Z])"\nreason = "A hook starts with use."\n';
    const policy = parsePolicyText(text, 'gspot.toml');
    const effective = effectivePolicy(exposedSettings([]), policy, '', [express]);
    const callback = rulesFor(effective, {
        file: 'src/routes/auth.ts',
        line: 1,
        column: 1,
        language: 'typescript',
        category: 'functions',
        kind: `typescript functions`,
        name: 'handleLogin',
    });
    expect(callback.map((rule) => rule.source)).toStrictEqual(['the express configuration']);
    expect(callback[0]!.structuralPrefix?.test('handleLogin')).toBe(true);
    const hook = rulesFor(effective, {
        file: 'src/hooks/login.ts',
        line: 1,
        column: 1,
        language: 'typescript',
        category: 'functions',
        kind: `typescript functions`,
        name: 'useLogin',
    });
    expect(hook.map((rule) => rule.source)).toStrictEqual(['the express configuration', '[[naming.rules]] entry 1']);
    // The framework rule names its languages, so a Python function is outside it.
    const python = rulesFor(effective, {
        file: 'src/app.py',
        line: 1,
        column: 1,
        language: 'python',
        category: 'functions',
        kind: `python functions`,
        name: 'handle_login',
    });
    expect(python.some((rule) => rule.source === 'the express configuration')).toBe(false);
});

test('an unselected framework contributes nothing', () => {
    const policy = parsePolicyText('version = 1\nconfigurations = ["typescript"]\n', 'gspot.toml');
    const effective = effectivePolicy(exposedSettings([]), policy, '', []);
    const rules = rulesFor(effective, {
        file: 'src/routes/auth.ts',
        line: 1,
        column: 1,
        language: 'typescript',
        category: 'functions',
        kind: `typescript functions`,
        name: 'handleLogin',
    });
    expect(rules.some((rule) => rule.source === 'the express configuration')).toBe(false);
});
