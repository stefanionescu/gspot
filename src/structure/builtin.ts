import { callThroughs } from '@/structure/call-through'
import { duplicateFunctions } from '@/structure/duplicate'
import { fileLengths, functionLengths } from '@/structure/lines'
import { unusedFunctions } from '@/structure/reach'
import { prefixCollisions, singleFileFolders } from '@/structure/walk'
import type { StructureOutcome } from 'types/structure'

export type BuiltinRequest = {
  readonly root: string
  readonly paths: readonly string[]
  readonly rule: string
  readonly limit: number
  readonly setting: string

  readonly entryPoints: readonly string[]
}

type Builtin = (request: BuiltinRequest) => Promise<StructureOutcome>

const BUILTINS: Readonly<Record<string, Builtin>> = {
  'single-file-folder': async (request) => ({
    findings: singleFileFolders(request.paths, request.rule),
    read: request.paths,
    broken: [],
  }),
  'prefix-collisions': async (request) => ({
    findings: prefixCollisions(request.paths, request.rule, request.limit),
    read: request.paths,
    broken: [],
  }),
  'call-through': callThroughs,
  'duplicate-functions': duplicateFunctions,
  'file-length': fileLengths,
  'function-length': functionLengths,
  'unused-functions': unusedFunctions,
}

export const BUILTIN_NAMES = Object.keys(BUILTINS)

export async function runBuiltin(name: string, request: BuiltinRequest): Promise<StructureOutcome> {
  return await (BUILTINS[name] as Builtin)(request)
}
