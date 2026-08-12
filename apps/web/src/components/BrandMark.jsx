export function BrandMark({ compact = false, inverse = false }) {
  return (
    <span className={`brand-lockup${inverse ? ' brand-lockup--inverse' : ''}`}>
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M7 9.5h7.5c2.2 0 4 1.8 4 4v5c0 2.2 1.8 4 4 4H25" />
          <circle cx="7" cy="9.5" r="2.5" />
          <circle cx="25" cy="22.5" r="2.5" />
          <path d="m11.5 20.5 3 3 6-7" />
        </svg>
      </span>
      {!compact && <span className="brand-wordmark">ProofFlow</span>}
    </span>
  );
}

export function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M8 6h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
