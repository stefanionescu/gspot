/** Typed Query APIs isolate the plugin's query-function and callback-order contracts. */
export const QUERY_PROJECT = {
    'package.json':
        '{"name":"query-rules","private":true,"type":"module","dependencies":{"@tanstack/react-query":"5.91.2"}}',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}',
    'src/query.d.ts': `declare module '@tanstack/react-query' {
    export function useQuery(options: { queryKey: string[]; queryFn: () => unknown }): unknown;
    export function useMutation(options: { onMutate: () => number; onError: () => void }): unknown;
}
`,
    'src/neighbor.ts':
        'import { useQuery } from "@tanstack/react-query";\nuseQuery({ queryKey: ["neighbor"], queryFn: () => 2 });\n',
};

export const QUERY_SAMPLE =
    'import { useQuery, useMutation } from "@tanstack/react-query";\nuseQuery({ queryKey: ["users"], queryFn: () => {} });\nuseMutation({ onError: () => {}, onMutate: () => 1 });\n';
export const QUERY_CORRECTION =
    'import { useQuery, useMutation } from "@tanstack/react-query";\nuseQuery({ queryKey: ["users"], queryFn: () => 1 });\nuseMutation({ onMutate: () => 1, onError: () => {} });\n';
