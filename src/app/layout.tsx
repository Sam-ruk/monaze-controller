import type { Metadata } from 'next';
import { ReactNode } from 'react';
import ClientWrapper from '@/components/ClientWrapper';
import './globals.css';

export const metadata: Metadata = {
  title: 'Neon Maze Controller',
  description: 'Phone controller for Neon Maze game',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta http-equiv="Permissions-Policy" content="gyroscope=*, accelerometer=*" />
      </head>
      <body>
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}