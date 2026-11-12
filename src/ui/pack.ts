// Private image pack: the user points the game at a folder on their own computer that contains image-pack.json.
// Images are downscaled and stored in this browser's IndexedDB only. Nothing is uploaded or bundled with the game.
import { Asset, clearAssets, putAssets } from '../persist/db';
import { loadAssets } from './store';

interface Manifest { format: string; players?: Record<string, string>; events?: Record<string, string>; trophies?: Record<string, string>; brands?: Record<string, { name: string; file: string }[]> }
async function shrink(file: File, max: number): Promise<Blob> {
  if (/\.svg$/i.test(file.name)) return new Blob([await file.arrayBuffer()], { type: 'image/svg+xml' });
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/webp', 0.85));
  } catch { return file; }
}
export async function importPack(files: FileList): Promise<string> {
  const all = [...files], rel = (f: File) => ((f as any).webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name;
  const mf = all.find(f => f.name === 'image-pack.json');
  if (!mf) return 'No image-pack.json was found in that folder.';
  let m: Manifest;
  try { m = JSON.parse(await mf.text()); } catch { return 'image-pack.json could not be read.'; }
  if (m.format !== 'tennis-career-image-pack') return 'That file is not a Tennis Career image pack.';
  const base = rel(mf).split('/').slice(0, -1).join('/'), byPath = new Map(all.map(f => [rel(f), f]));
  const find = (p: string) => byPath.get(base ? `${base}/${p}` : p);
  const out: Asset[] = []; let missing = 0;
  const add = async (key: string, path: string, max: number, label?: string) => { const f = find(path); if (!f) { missing++; return; } out.push({ key, blob: await shrink(f, max), label }); };
  for (const [name, p] of Object.entries(m.players ?? {})) await add(`player:${name}`, p, 240);
  for (const [k, p] of Object.entries(m.events ?? {})) await add(`event:${k}`, p, 320);
  for (const [k, p] of Object.entries(m.trophies ?? {})) await add(`trophy:${k}`, p, 640);
  for (const [slot, list] of Object.entries(m.brands ?? {})) for (let i = 0; i < list.length; i++) await add(`brand:${slot}:${i}`, list[i].file, 240, list[i].name);
  await putAssets(out); await loadAssets();
  return `Loaded ${out.length} images${missing ? `; ${missing} listed files were not found` : ''}.`;
}
export async function clearPack() { await clearAssets(); await loadAssets(); }
