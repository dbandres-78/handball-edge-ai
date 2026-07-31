import { ClubProjectionView } from '@/features/catalog/ClubProjectionView';

export const dynamic = 'force-dynamic';

export default function ClubPage({ params }: { params: { clubId: string } }) {
  return <ClubProjectionView clubId={params.clubId} />;
}
