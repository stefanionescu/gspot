export const SELECTION_INIT = ['init', '--yes', '--dry-run', '--json'];

export const COMPONENT = '<script setup>\nconst name = 1;\n</script>\n<template><p>{{ name }}</p></template>\n';

export const NON_JAVASCRIPT_PROJECTS = [
    ['Python', 'source.py', 'VALUE = 1\n'],
    ['Swift', 'source.swift', 'let value = 1\n'],
    ['Markdown', 'README.md', '# Example\n'],
] as const;

export const TOOLING_PACKAGE = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';
