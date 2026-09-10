import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const presentation = await PresentationFile.importPptx(await FileBlob.load('/home/m/code/day-shaper/output/dayshape-hackathon-pitch-final.pptx'));
const snapshot = await presentation.inspect({ kind: 'slide,textbox,shape,image,notes,layout', maxChars: 12000 });
console.log(snapshot.ndjson);
