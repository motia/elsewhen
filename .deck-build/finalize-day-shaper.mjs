import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const workspaceDir = '/home/m/code/day-shaper';
const skillDir = '/home/m/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations';
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const finalPath = path.join(workspaceDir, 'output', 'dayshape-hackathon-pitch-final.pptx');
await fs.mkdir(path.dirname(finalPath), { recursive: true });
const result = await finalizePresentation({
  explicitTotalSlideCount: 7,
  requiredNativeTableOwnerSlides: [],
  workspaceDir,
  candidatePath: path.join(workspaceDir, '.codex-finalizer', 'dayshape-hackathon-pitch-candidate.pptx'),
  finalPath,
  pythonExecutable: '/home/m/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit'],
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, '.codex-finalizer', 'dayshape-hackathon-pitch-final.validation.json'),
});
console.log(JSON.stringify(result));
