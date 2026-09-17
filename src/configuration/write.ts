import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ConfigArtifact, Preset } from 'types/manifest'

import { render, stubFor } from '@/configuration/render'
import type { ResolvedSetting } from 'types/settings'
import type { GeneratedFile } from 'types/configuration'

export type RenderAllInputs = {
  readonly presets: readonly Preset[]
  readonly settings: ReadonlyMap<string, ResolvedSetting>
  readonly version: string

  readonly stubs: ReadonlySet<string>
}

export async function renderAll(inputs: RenderAllInputs): Promise<readonly GeneratedFile[]> {
  const files: GeneratedFile[] = []
  for (const preset of inputs.presets) {
    for (const artifact of preset.configs) {
      files.push(await renderArtifact(preset, artifact, inputs))
      const stub = stubOf(artifact, inputs)
      if (stub !== null) files.push(stub)
    }
  }
  return files
}

async function renderArtifact(
  preset: Preset,
  artifact: ConfigArtifact,
  inputs: RenderAllInputs,
): Promise<GeneratedFile> {
  const templatePath = join(dirname(preset.source), artifact.template)
  return {
    path: artifact.target,
    contents: render({
      template: await readTemplate(templatePath, preset, artifact),
      settings: inputs.settings,
      version: inputs.version,
      target: artifact.target,
      source: templatePath,
    }),
    readers: artifact.readers,
    isStub: false,
  }
}

async function readTemplate(
  path: string,
  preset: Preset,
  artifact: ConfigArtifact,
): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    throw new Error(
      `${preset.source}: \`${artifact.target}\` names the template \`${artifact.template}\`, ` +
        'and there is no such file beside the manifest.',
    )
  }
}

function stubOf(artifact: ConfigArtifact, inputs: RenderAllInputs): GeneratedFile | null {
  if (artifact.stub === undefined || !inputs.stubs.has(artifact.target)) return null
  const contents = stubFor(artifact, inputs.version)
  if (contents === null) return null
  return { path: artifact.stub, contents, readers: artifact.readers, isStub: true }
}

export async function writeAll(root: string, files: readonly GeneratedFile[]): Promise<void> {
  for (const file of files) {
    const target = join(root, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.contents, 'utf8')
  }
}
