'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { PALETTE as C } from '@/lib/theme';

/**
 * Papelera que aparece al pasar por encima de la tarjeta. Vive como HERMANA del <Link> de la
 * tarjeta (no dentro), así el clic no navega. Pide confirmación antes de borrar.
 */
export function DeleteMatchButton({ matchId, label }: { matchId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`¿Borrar "${label}"? Se eliminan el partido y sus datos. No se puede deshacer.`)) return;
    setBusy(true);
    const r = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
    if (r.ok) {
      router.refresh();
    } else {
      setBusy(false);
      window.alert('No se pudo borrar el partido.');
    }
  };

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      title="Borrar partido"
      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1.5"
      style={{ background: C.panel3, border: `1px solid ${C.line}`, color: C.neg, zIndex: 2, opacity: busy ? 0.6 : undefined }}
    >
      <Trash2 size={13} />
    </button>
  );
}
