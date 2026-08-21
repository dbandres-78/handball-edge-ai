'use client';
import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { PALETTE as C } from '@/lib/theme';

interface Props {
  src?: string | null;
  uploadUrl: string;
  onUploaded?: (photoUrl: string) => void;
  onRemoved?: () => void;
  size?: number;
  alt?: string;
  rounded?: boolean;
}

/**
 * Subida de foto reutilizable para club y jugador: miniatura + botón de cámara superpuesto.
 * Sube directamente al elegir el fichero (sin paso de confirmación aparte) para no romper
 * el flujo de alta. La versión en la URL evita que el navegador sirva la miniatura cacheada
 * tras sustituir la foto en la misma ruta de servido.
 */
export function PhotoUploader({ src, uploadUrl, onUploaded, onRemoved, size = 56, alt = 'Foto', rounded = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'No se pudo subir la foto');
      setVersion(Date.now());
      onUploaded?.(d.photoUrl);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo subir la foto');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await fetch(uploadUrl, { method: 'DELETE' });
      setVersion(Date.now());
      onRemoved?.();
    } finally {
      setBusy(false);
    }
  };

  const radius = rounded ? '50%' : 8;

  return (
    <div className="inline-flex flex-col items-center gap-1" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <div className="w-full h-full flex items-center justify-center overflow-hidden"
          style={{ borderRadius: radius, background: C.panel2, border: `1px solid ${C.line}` }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${src}?v=${version}`} alt={alt} className="w-full h-full object-cover" />
          ) : (
            <Camera size={Math.round(size * 0.36)} color={C.faint} />
          )}
        </div>
        <button type="button" onClick={pick} disabled={busy} title="Subir foto"
          className="absolute flex items-center justify-center"
          style={{ bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: C.amber, color: '#0E1420', border: `2px solid ${C.bg}` }}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
        </button>
        {src && !busy && (
          <button type="button" onClick={remove} title="Quitar foto"
            className="absolute flex items-center justify-center"
            style={{ top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: C.panel3, color: C.faint }}>
            <X size={10} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {error && <span style={{ fontSize: 9, color: C.neg, textAlign: 'center', maxWidth: size * 2 }}>{error}</span>}
    </div>
  );
}
