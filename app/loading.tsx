export default function Loading() {
  return <main className="shell platform-loading" role="status"><div className="skeleton-heading" /><div className="shelf-skeleton">{[0, 1, 2, 3].map(index => <div key={index} />)}</div><span className="sr-only">Loading titles…</span></main>;
}

