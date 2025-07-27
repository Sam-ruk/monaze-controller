'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Controller from '../components/Controller';

function HomeContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');

  return (
    <div>
      {gameId ? <Controller gameId={gameId} /> : <p>Loading game...</p>}
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