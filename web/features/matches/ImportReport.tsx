'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, X, CheckCircle2 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';

/**
 * Importación de un informe real (formato Handball.AI) desde la biblioteca.
 *
 * El componente NO valida el contenido del informe: lee el archivo, lo envía tal cual a
 * POST /api/matches/import y muestra el veredicto del adaptador del core. Un único punto
 * de validación (ReportImportAdapter), sin lógica duplicada en cliente que pueda derivar.
 */

interface ImportOk {
  matchId: string;
  competition?: string;
  matchday?: number;
  home: string;
  away: string;
  eventCount: number;
}

export function ImportReport() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportOk | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFileName(null); setPayload(null); setError(null); setDone(null); setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const close = () => { setOpen(false); reset(); };

  const takeFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null); setDone(null);
    // Solo lectura local del texto; el JSON lo valida el servidor (fallo ruidoso, no silencioso).
    const text = await file.text();
    setFileName(file.name);
    setPayload(text);
  };

  const submit = async () => {
    if (!payload) { setError('Selecciona primero un informe (.json)'); return; }
    setBusy(true); setError(null);
    let r: Response;
    try {
      r = await fetch('/api/matches/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });
    } catch {
      setBusy(false); setError('No se pudo contactar con el servidor'); return;
    }
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(data.error ?? 'No se pudo importar el informe'); return; }
    setDone(data as ImportOk);
    // Refresca la lista en segundo plano: si el usuario cierra, el partido ya aparece.
    router.refresh();
  };

  const goToMatch = () => {
    if (done) router.push(`/matches/${done.matchId}/analyze`);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
        style={{ color: C.text, border: `1px solid ${C.line}`, background: C.panel, fontWeight: 600 }}>
        <FileUp size={14} /> Importar informe
      </button>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 50 }}>
      <div className="w-full rounded-xl p-5" style={{ maxWidth: 460, background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileUp size={16} color={C.amber} />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Importar informe de partido</h2>
          </div>
          <button onClick={close} style={{ color: C.faint }}><X size={16} /></button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2" style={{ color: C.goal, fontSize: 14 }}>
              <CheckCircle2 size={16} /> Partido importado
            </div>
            <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 14, color: C.text }}>{done.home} <span style={{ color: C.faint }}>vs</span> {done.away}</div>
              <div className="mt-1" style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>
                {done.competition ?? 'Sin competición'}{done.matchday ? ` · J${done.matchday}` : ''} · {done.eventCount} eventos
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.faint }}>
              El marcador y toda la estadística (Play Score, xG, paradas) se recomputan desde los eventos del informe.
            </div>
            <div className="flex items-center gap-2 justify-end mt-1">
              <button onClick={reset} className="px-3 py-2 rounded-md text-sm" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
                Importar otro
              </button>
              <button onClick={goToMatch} className="px-4 py-2 rounded-md text-sm"
                style={{ background: C.amber, color: '#0E1420', fontWeight: 700 }}>
                Abrir análisis
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void takeFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileInput.current?.click()}
              className="rounded-lg p-6 text-center cursor-pointer transition-colors"
              style={{
                border: `1px dashed ${dragOver ? C.amber : C.line}`,
                background: dragOver ? 'rgba(255,193,7,.06)' : C.bg,
              }}
            >
              <input ref={fileInput} type="file" accept=".json,application/json" className="hidden"
                onChange={(e) => void takeFile(e.target.files?.[0])} />
              {fileName ? (
                <div style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{fileName}</div>
              ) : (
                <div style={{ fontSize: 13, color: C.muted }}>
                  Arrastra aquí el informe <span style={{ fontFamily: MONO }}>.json</span> o haz clic para elegirlo
                </div>
              )}
              <div className="mt-1" style={{ fontSize: 11, color: C.faint }}>Formato Handball.AI (meta, plantillas, cronograma)</div>
            </div>

            {error && <div style={{ fontSize: 12, color: C.neg }}>{error}</div>}

            <div className="flex items-center gap-2 justify-end mt-1">
              <button onClick={close} className="px-3 py-2 rounded-md text-sm" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
                Cancelar
              </button>
              <button onClick={submit} disabled={busy || !payload} className="px-4 py-2 rounded-md text-sm"
                style={{ background: C.amber, color: '#0E1420', fontWeight: 700, opacity: busy || !payload ? 0.6 : 1 }}>
                {busy ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
