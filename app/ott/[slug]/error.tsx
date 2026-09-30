"use client";
export default function PlatformError({ reset }: { reset: () => void }) {
  return <main className="shell platform-page"><div className="cinema-empty" role="alert"><h1>This platform couldn’t be loaded</h1><p>Please try again.</p><button className="violet-button" onClick={reset}>Try again</button></div></main>;
}

