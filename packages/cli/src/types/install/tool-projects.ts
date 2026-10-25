export type PythonToolProject = { name: string; version: string; 'requires-python': string; dependencies: string[] };

export type StaleLockfile = { path: string; kind?: 'missing' | 'changed' };
