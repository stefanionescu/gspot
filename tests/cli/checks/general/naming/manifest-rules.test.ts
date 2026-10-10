// A framework carries the naming rules of its own files in its manifest, and the repository's rules follow them.
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { rulesFor } from '#cli/checks/general/naming/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { effectivePolicy } from '#cli/checks/general/naming/contracts.ts';
import { knownSettings, effectiveSettings } from '#cli/policy/settings/public.ts';

const manifests = configurationManifests();
const javascript = manifests.get('javascript')!;
const express = manifests.get('express')!;
test('a selected framework adds its rules after the shipped ones and before the repository rules', () => {
    const text = buildPolicy(['typescript', 'express'], {
        agentRules: true,
        tables: '[[naming.overrides]]\npaths = ["src/hooks/**"]\ncategories = ["functions"]\nignored_prefix = "^use(?=[A-Z])"\nreason = "A hook starts with use."\n',
    });
    const policy = parseStrictPolicy(text);
    const effective = effectivePolicy(effectiveSettings(knownSettings([]), policy, [], ''), policy, '', [
        javascript,
        express,
    ]);
    const callback = rulesFor(effective, {
        file: 'src/routes/auth.ts',
        line: 1,
        column: 1,
        language: 'typescript',
        category: 'functions',
        kind: `typescript functions`,
        name: 'handleLogin',
    });
    expect(callback.map((rule) => rule.source)).toStrictEqual(['the javascript configuration']);
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
    expect(hook.map((rule) => rule.source)).toStrictEqual([
        'the javascript configuration',
        '[[naming.overrides]] entry 1',
    ]);
    // The JavaScript rule names its languages, so a Python function is outside it.
    const python = rulesFor(effective, {
        file: 'src/app.py',
        line: 1,
        column: 1,
        language: 'python',
        category: 'functions',
        kind: `python functions`,
        name: 'handle_login',
    });
    expect(python.some((rule) => rule.source === 'the javascript configuration')).toBe(false);
});
