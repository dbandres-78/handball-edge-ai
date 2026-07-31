import { getCatalogRepo } from '@/features/catalog/repository';
import { ClubsGrid } from '@/features/catalog/ClubsGrid';

export const dynamic = 'force-dynamic';

export default async function ClubsPage() {
  const clubs = await (await getCatalogRepo()).listClubs();
  return <ClubsGrid clubs={clubs} />;
}
