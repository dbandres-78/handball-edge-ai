import { notFound } from 'next/navigation';
import { getMatchesRepo } from '@/features/matches/repository';
import { AnalysisRoom } from '@/features/analysis/AnalysisRoom';

export const dynamic = 'force-dynamic';

export default async function AnalyzePage({ params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) notFound();
  return <AnalysisRoom match={match} />;
}
