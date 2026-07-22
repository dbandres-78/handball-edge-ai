import { getMatchesRepo } from '@/features/matches/repository';
import { MatchLibrary } from '@/features/matches/MatchLibrary';

export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  const items = await (await getMatchesRepo()).list();
  return <MatchLibrary items={items} />;
}
