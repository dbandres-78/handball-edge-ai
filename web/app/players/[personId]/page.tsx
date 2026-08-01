import { PlayerCareerView } from '@/features/catalog/PlayerCareerView';

export const dynamic = 'force-dynamic';

export default function PlayerCareerPage({ params }: { params: { personId: string } }) {
  return <PlayerCareerView personId={params.personId} />;
}
