// The asset and face packs ship with the site under packs/. On first run (or after a browser's storage is cleared)
// they are downloaded once and stored in this browser, so nobody has to load them by hand.
// Removing a pack in Settings turns its automatic loading off for this browser.
import { getSetting } from '../persist/db';
import { facesLoaded, importFaces } from './faces';
import { importAssetFile } from './pack';
import { get, set } from './store';

async function fetchFile(path: string, name: string) {
  const r = await fetch(path, { cache: 'force-cache' }); if (!r.ok) throw new Error(String(r.status));
  return new File([await r.blob()], name);
}
export async function autoLoadPacks() {
  try {
    if (!Object.keys(get().assets).length && getSetting('noAutoAssets', '0') !== '1') {
      set({ packNote: 'Loading player photos and logos…' } as any);
      await importAssetFile(await fetchFile('packs/tennis-career-assets.tcassets', 'tennis-career-assets.tcassets'));
    }
    if (!facesLoaded() && getSetting('noAutoFaces', '0') !== '1') {
      set({ packNote: 'Loading player faces…' } as any);
      await importFaces(await fetchFile('packs/tennis-career-faces.tcfaces', 'tennis-career-faces.tcfaces'));
    }
  } catch { /* packs are optional: the game works without them */ }
  set({ packNote: '' } as any);
}
