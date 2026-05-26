import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'E-Test · Validá productos antes de importarlos',
  description:
    'Pegá un link de Alibaba y obtené en segundos un veredicto de viabilidad: gate de margen, score de 9 dimensiones, competencia real y ángulos de venta.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
