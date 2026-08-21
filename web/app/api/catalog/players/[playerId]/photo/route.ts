import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';
import { savePhoto, readPhoto, clearPhoto, photoServingUrl } from '@/lib/photos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — sube (o sustituye) la foto del jugador. multipart/form-data, campo "photo". */
export async function POST(req: Request, { params }: { params: { playerId: string } }) {
  const catalog = await getCatalogRepo();
  const player = await catalog.getPlayer(params.playerId);
  if (!player) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fichero de la foto' }, { status: 400 });

  const saved = await savePhoto('players', params.playerId, file);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });

  const photoUrl = photoServingUrl('players', params.playerId);
  await catalog.updatePlayer(params.playerId, { photoUrl });
  return NextResponse.json({ ok: true, photoUrl });
}

/** GET — sirve la imagen guardada. */
export async function GET(_req: Request, { params }: { params: { playerId: string } }) {
  const found = await readPhoto('players', params.playerId);
  if (!found) return NextResponse.json({ error: 'Sin foto' }, { status: 404 });
  return new NextResponse(new Uint8Array(found.buf), { headers: { 'Content-Type': found.mime, 'Cache-Control': 'private, max-age=300' } });
}

/** DELETE — quita la foto del jugador. */
export async function DELETE(_req: Request, { params }: { params: { playerId: string } }) {
  const catalog = await getCatalogRepo();
  const player = await catalog.getPlayer(params.playerId);
  if (!player) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
  await clearPhoto('players', params.playerId);
  await catalog.updatePlayer(params.playerId, { photoUrl: '' });
  return NextResponse.json({ ok: true });
}
