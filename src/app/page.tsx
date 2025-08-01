'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Controller from '../components/Controller';

function HomeContent() {
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId');

  return (
    <div>
      {playerId ? <Controller playerId={playerId} /> : <p>Loading game...</p>}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <HomeContent />
    </Suspense>
  );
}