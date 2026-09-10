import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const workspace = '/home/m/code/day-shaper';
const source = path.join(workspace, 'output', 'dayshape-hackathon-pitch-final.pptx');
const candidate = path.join(workspace, '.codex-finalizer', 'dayshape-hackathon-pitch-suggested-plans-candidate.pptx');
const deck = await PresentationFile.importPptx(await FileBlob.load(source));
const slide = deck.resolve('sl/gnmp4jqx');
deck.resolve('sh/dcbud0ra').text = 'Suggested plans\nfor tonight';
deck.resolve('sh/ydkbm5sv').text = 'DayShape offers a few options that fit the user’s mood, available time, and location.';
deck.resolve('sh/zedcfa9g').text = 'Choose what feels right, then make it your plan.';
const image = deck.resolve('im/rul4vapk');
image.replace({
  blob: await fs.readFile(path.join(workspace, '.deck-build', 'assets', 'results.png')),
  contentType: 'image/png',
  alt: 'DayShape suggested plans',
});
slide.speakerNotes.textFrame.setText('Close with choice, not a fixed itinerary. DayShape offers a short set of suggested plans that already fit the person’s mood, availability, and location. The user keeps control by choosing the option that feels right. Invite questions after this slide.');
await (await PresentationFile.exportPptx(deck)).save(candidate);
console.log(candidate);
