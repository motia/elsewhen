import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = '/home/m/code/day-shaper';
const skillDir = '/home/m/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations';
const buildDir = path.join(workspaceDir, '.deck-build');
const assets = path.join(buildDir, 'assets');
const { resolvePresentationFont } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const font = resolvePresentationFont();
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = { ink: '#11182F', muted: '#5E6987', purple: '#6556BA', soft: '#EEEBFF', cream: '#FFFDF9', green: '#DDEFD3' };
function box(slide, text, x, y, w, h, size, color = C.ink, bold = false, align = 'left') {
  const shape = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = text;
  shape.text.style = { typeface: font, fontSize: size, color, bold, autoFit: 'shrinkText', paragraphFormat: { alignment: align } };
  return shape;
}
function chrome(slide, number, label = 'DAYSHAPE') {
  box(slide, label, 64, 42, 260, 24, 13, C.purple, true);
  box(slide, String(number).padStart(2, '0'), 1160, 42, 56, 24, 13, C.muted, true, 'right');
}
async function shot(slide, filename, x, y, w, h) {
  slide.images.add({ blob: await fs.readFile(path.join(assets, filename)), contentType: 'image/png', alt: `DayShape ${filename.replace('.png', '')} screen`, fit: 'cover', position: { left: x, top: y, width: w, height: h }, geometry: 'roundRect', borderRadius: 'rounded-xl' });
}
function notes(slide, text) { slide.speakerNotes.textFrame.setText(text); }

// 1. Cover
{ const s = deck.slides.add(); s.background.fill = C.cream;
  box(s, 'DAYSHAPE', 66, 58, 250, 30, 15, C.purple, true);
  box(s, 'Make free time\nfeel well spent', 66, 140, 530, 160, 54, C.ink, true);
  box(s, 'A calmer way to choose what to do, based on what you want and the energy you have.', 70, 333, 475, 74, 23, C.muted);
  box(s, 'Hackathon pitch', 70, 604, 220, 28, 16, C.purple, true);
  await shot(s, 'home.png', 650, 110, 560, 470);
  notes(s, 'Open with the outcome. DayShape helps people use free time in ways that feel meaningful, without turning planning into work.');
}

// 2. Problem
{ const s = deck.slides.add(); s.background.fill = '#F7F5FB'; chrome(s, 2);
  box(s, 'Free time creates a\ndecision problem', 66, 122, 570, 128, 44, C.ink, true);
  box(s, 'When the day opens up, people still need to answer three personal questions:', 70, 282, 560, 58, 22, C.muted);
  box(s, 'What do I actually want?\nWhat do I have energy for?\nWhat can fit today?', 82, 390, 500, 178, 29, C.ink, true);
  await shot(s, 'home.png', 710, 170, 460, 325);
  box(s, 'A calendar can show an empty slot. It cannot tell you how to spend it.', 710, 540, 450, 52, 19, C.purple, true);
  notes(s, 'Most planning tools stop at availability. An empty evening is not the same as a clear decision. DayShape starts with what the person needs right now.');
}

// 3. Mood map
{ const s = deck.slides.add(); s.background.fill = C.cream; chrome(s, 3);
  box(s, 'The mood map makes\npreferences visible', 66, 116, 460, 128, 42, C.ink, true);
  box(s, 'Each icon sits on two simple axes: how much the person wants it and how much capacity they have for it.', 70, 280, 470, 105, 22, C.muted);
  box(s, 'In the demo, Focus, Novelty, Connection, and Movement all move. The selected icon updates the explanation beside it.', 70, 463, 465, 88, 19, C.purple, true);
  await shot(s, 'mood.png', 595, 116, 620, 460);
  notes(s, 'This is the core interaction. It avoids a long questionnaire and gives users a direct way to describe their current state. Mention the two axes: want and capacity.');
}

// 4. Availability
{ const s = deck.slides.add(); s.background.fill = '#F7F5FB'; chrome(s, 4);
  box(s, 'Availability adds\nreal-world constraints', 66, 116, 490, 128, 42, C.ink, true);
  box(s, 'The user chooses open time, connects a calendar if they want, and can override individual events.', 70, 282, 470, 96, 22, C.muted);
  box(s, 'The goal is a plan that fits the evening, not another list to browse.', 70, 465, 450, 65, 20, C.purple, true);
  await shot(s, 'availability.png', 590, 116, 625, 460);
  notes(s, 'After preferences, DayShape checks the practical boundary: time. The calendar view makes the recommendation window transparent and editable.');
}

// 5. Matching
{ const s = deck.slides.add(); s.background.fill = C.cream; chrome(s, 5);
  box(s, 'Matching combines\ncontext and options', 66, 116, 465, 128, 42, C.ink, true);
  box(s, 'DayShape considers mood, capacity, available time, and location before ranking local activities.', 70, 282, 480, 98, 22, C.muted);
  box(s, 'The interface makes the matching process visible, so the recommendation does not feel like a black box.', 70, 463, 475, 85, 19, C.purple, true);
  await shot(s, 'matching.png', 594, 116, 620, 460);
  notes(s, 'Keep this brief in the live pitch. We search for event options, use AI-assisted matching, and filter against availability. The user sees what the product is doing.');
}

// 6. Recommendations and demo
{ const s = deck.slides.add(); s.background.fill = '#F7F5FB'; chrome(s, 6);
  box(s, 'Recommendations\nwith a reason', 66, 116, 450, 128, 42, C.ink, true);
  box(s, 'Each pick shows time, distance, cost, tags, and a match score. The user can see why it belongs in their evening.', 70, 282, 465, 102, 22, C.muted);
  box(s, 'Live demo cue\nPlay the DayShape video here. It stays on each screen long enough to narrate the flow.', 70, 470, 470, 94, 19, C.purple, true);
  await shot(s, 'results.png', 580, 116, 635, 460);
  notes(s, 'Play the 59-second DayShape demo here. Let the results screen breathe, then transition to the final plan. Keep the phone on silent and use its speaker notes only as a timing cue.');
}

// 7. Close
{ const s = deck.slides.add(); s.background.fill = C.cream; chrome(s, 7);
  box(s, 'A better answer to\n“What should I do tonight?”', 66, 112, 590, 132, 42, C.ink, true);
  box(s, 'DayShape turns an open slot into a plan that fits the person, the moment, and the city around them.', 70, 287, 520, 96, 23, C.muted);
  box(s, 'Time well spent feels different.', 70, 500, 490, 42, 25, C.purple, true);
  await shot(s, 'agenda.png', 642, 110, 570, 475);
  notes(s, 'Close on the outcome: a plan the person can actually follow. Invite questions after the final line.');
}

await fs.mkdir(path.join(workspaceDir, '.codex-finalizer'), { recursive: true });
const candidate = path.join(workspaceDir, '.codex-finalizer', 'dayshape-hackathon-pitch-candidate.pptx');
await (await PresentationFile.exportPptx(deck)).save(candidate);
console.log(candidate);
