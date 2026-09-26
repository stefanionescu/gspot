// A framework carries the naming rules of its own files in its manifest, and the repository's rules follow them (K-50).
import { expect, test } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read.ts';
import type { Identifier } from '#cli/types/checks/naming.ts';
import { exposedSettings } from '#cli/policy/setting-surface.ts';
import { effectivePolicy, rulesFor } from '#cli/checks/naming/policy.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

const manifests = configurationManifests();
const express = manifests.get('express')!;

function identifier(name: string, language: string, category: string, file: string): Identifier {
    return { file, line: 1, column: 1, language, category, kind: `${language} ${category}`, name };
}

test('a selected framework adds its rules after the shipped ones and before the repository rules', () => {
    const text =
        'version = 1\nconfigurations = ["typescript", "express"]\n[[naming.rules]]\npaths = ["src/hooks/**"]\ncategories = ["functions"]\nstructural_prefix = "^use(?=[A-Z])"\nreason = "A hook starts with use."\n';
    const policy = parsePolicyText(text, 'gspot.toml');
    const effective = effectivePolicy(exposedSettings([]), policy, '', [express]);
    const handler = rulesFor(effective, identifier('handleLogin', 'typescript', 'functions', 'src/routes/auth.ts'));
    expect(handler.map((rule) => rule.source)).toStrictEqual(['the express configuration']);
    expect(handler[0]!.structuralPrefix?.test('handleLogin')).toBe(true);
    const hook = rulesFor(effective, identifier('useLogin', 'typescript', 'functions', 'src/hooks/login.ts'));
    expect(hook.map((rule) => rule.source)).toStrictEqual(['the express configuration', '[[naming.rules]] entry 1']);
    // The framework rule names its languages, so a Python function is outside it.
    const python = rulesFor(effective, identifier('handle_login', 'python', 'functions', 'src/app.py'));
    expect(python.some((rule) => rule.source === 'the express configuration')).toBe(false);
});

test('an unselected framework contributes nothing', () => {
    const policy = parsePolicyText('version = 1\nconfigurations = ["typescript"]\n', 'gspot.toml');
    const effective = effectivePolicy(exposedSettings([]), policy, '', []);
    const rules = rulesFor(effective, identifier('handleLogin', 'typescript', 'functions', 'src/routes/auth.ts'));
    expect(rules.some((rule) => rule.source === 'the express configuration')).toBe(false);
});
