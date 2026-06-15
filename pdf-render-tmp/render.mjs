import { pdf } from "pdf-to-img";
import fs from "node:fs/promises";

const src = "c:/Users/Admin/Desktop/proyectosengo/Documentacion de hacienda/Cat\u00e1logos- Facturaci\u00f3n Electr\u00f3nica (3).pdf";
const outDir = "c:/Users/Admin/Desktop/proyectosengo/pdf-render-tmp/pages";
await fs.mkdir(outDir, { recursive: true });

const start = Number(process.argv[2] || 2);
const end = Number(process.argv[3] || 4);

const document = await pdf(src, { scale: 2 });
let i = 0;
for await (const page of document) {
  i++;
  if (i < start) continue;
  if (i > end) break;
  await fs.writeFile(`${outDir}/page-${String(i).padStart(2, "0")}.png`, page);
  console.log("wrote page", i);
}
console.log("done");
