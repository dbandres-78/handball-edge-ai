import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clubs = await (await getCatalogRepo()).listClubs();
  return NextResponse.json({ clubs });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string; shortName?: string; color?: string } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'Falta el nombre del club' }, { status: 400 });
  const club = await (await getCatalogRepo()).createClub({
    name, shortName: body?.shortName?.trim() || undefined, color: body?.color?.trim() || undefined,
  });
  return NextResponse.json({ club }, { status: 201 });
}
