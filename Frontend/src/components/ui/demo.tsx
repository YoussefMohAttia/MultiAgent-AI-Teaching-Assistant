'use client';

import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';

interface SplineSceneBasicProps {
  onSignIn?: () => void;
}

export function SplineSceneBasic({ onSignIn }: SplineSceneBasicProps) {
  return (
    <section className="relative w-screen min-h-screen bg-black overflow-hidden">
      <Spotlight
        className="-top-40 -left-20 md:left-40 md:-top-20"
        fill="white"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35 z-[2]" />

      <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 md:p-14 lg:p-20 flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Squee Learn</p>
          <h1 className="mt-3 text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            Study Smarter
          </h1>
          <p className="mt-5 text-neutral-300 max-w-xl text-base md:text-lg leading-relaxed">
            Your AI-powered learning workspace for summaries, quizzes, tutoring, and evaluation.
            Sign in to continue to your courses and tools.
          </p>

          <button
            type="button"
            onClick={onSignIn}
            className="mt-8 w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition"
          >
            Continue with Google
          </button>
        </div>

        <div className="relative min-h-[45vh] md:min-h-screen">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
}
