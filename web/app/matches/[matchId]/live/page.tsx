import { notFound } from 'next/navigation';
import { getMatchesRepo } from '@/features/matches/repository';
import { LiveRoom } from '@/features/live/LiveRoom';

export const dynamic = 'force-dynamic';

export default async function LivePage({ params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) notFound();
  return <LiveRoom match={match} />;
}
