import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Handball Edge AI',
  description: 'Análisis de partidos de balonmano: vídeo, corte y extracción de estadística.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
