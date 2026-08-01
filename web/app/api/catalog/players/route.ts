import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

/** Lista plana de todos los jugadores del catálogo (con nombre de club) para el selector de vinculación. */
export async function GET() {
  const catalog = await getCatalogRepo();
  const players = await catalog.listAllRoster();
  return NextResponse.json({ players });
}
