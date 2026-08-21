import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';
import { savePhoto, readPhoto, clearPhoto, photoServingUrl } from '@/lib/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — sube (o sustituye) la foto/escudo del club. multipart/form-data, campo "photo". */
export async function POST(req: Request, { params }: { params: { clubId: string } }) {
  const catalog = await getCatalogRepo();
  const club = await catalog.getClub(params.clubId);
  if (!club) return NextResponse.json({ error: 'Club no encontrado' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fichero de la foto' }, { status: 400 });

  const saved = await savePhoto('clubs', params.clubId, file);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });

  const photoUrl = photoServingUrl('clubs', params.clubId);
  await catalog.updateClub(params.clubId, { photoUrl });
  return NextResponse.json({ ok: true, photoUrl });
}

/** GET — sirve la imagen guardada. */
export async function GET(_req: Request, { params }: { params: { clubId: string } }) {
  const found = await readPhoto('clubs', params.clubId);
  if (!found) return NextResponse.json({ error: 'Sin foto' }, { status: 404 });
  return new NextResponse(new Uint8Array(found.buf), { headers: { 'Content-Type': found.mime, 'Cache-Control': 'private, max-age=300' } });
}

/** DELETE — quita la foto del club. */
export async function DELETE(_req: Request, { params }: { params: { clubId: string } }) {
  const catalog = await getCatalogRepo();
  const club = await catalog.getClub(params.clubId);
  if (!club) return NextResponse.json({ error: 'Club no encontrado' }, { status: 404 });
  await clearPhoto('clubs', params.clubId);
  await catalog.updateClub(params.clubId, { photoUrl: '' });
  return NextResponse.json({ ok: true });
}
