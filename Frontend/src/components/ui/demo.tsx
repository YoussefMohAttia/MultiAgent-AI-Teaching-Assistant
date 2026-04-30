'use client';

import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';
import { useLanguage } from '@/contexts/LanguageContext';

interface SplineSceneBasicProps {
  onSignIn?: () => void;
}

export function SplineSceneBasic({ onSignIn }: SplineSceneBasicProps) {
  const { t } = useLanguage();

  return (
    <section className="relative w-screen min-h-screen bg-black overflow-hidden">
      <Spotlight
        className="-top-40 -left-20 md:left-40 md:-top-20"
        fill="white"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35 z-[2]" />

      <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 md:p-14 lg:p-20 flex flex-col justify-center">
          <h1 className="mt-3 text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            SQUEE LEARN
          </h1>
          <p className="mt-5 text-neutral-300 max-w-xl text-base md:text-lg leading-relaxed">
            {t('signInTagline')}
          </p>

          <button
            type="button"
            onClick={onSignIn}
            className="mt-8 w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition inline-flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path fill="#EA4335" d="M24 9.5c3.2 0 6.1 1.1 8.4 3.2l6.3-6.3C34.8 2.9 29.7 1 24 1 14.7 1 6.6 6.4 2.7 14.3l7.4 5.7C12.1 14 17.6 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.6c0-1.6-.1-2.8-.4-4.1H24v8h12.8c-.3 2-1.8 5-5.2 7.1l8 6.2c4.8-4.4 7.6-10.9 7.6-17.2z"/>
              <path fill="#FBBC05" d="M10.1 28.7c-.6-1.8-.9-3.7-.9-5.7s.3-3.9.9-5.7l-7.4-5.7C1 15.2 0 19 0 23s1 7.8 2.7 11.4l7.4-5.7z"/>
              <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-8-6.2c-2.1 1.4-4.9 2.4-7.9 2.4-6.4 0-11.9-4.5-13.9-10.6l-7.4 5.7C6.6 40.6 14.7 47 24 47z"/>
            </svg>
            {t('signInButton')}
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
