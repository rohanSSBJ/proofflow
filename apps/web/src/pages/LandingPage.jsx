import { Link } from 'react-router-dom';
import { ArrowIcon, BrandMark, CheckIcon } from '../components/BrandMark.jsx';

const trustChain = ['Obligation', 'Assignment', 'Evidence', 'Review', 'Verified', 'Auditable'];
const roles = [
  ['Managers', 'See what is truly complete—not merely checked off.', 'proofflow-team.webp'],
  ['Contributors', 'Know exactly what proof is expected before work begins.', 'proofflow-collaboration.webp'],
  ['Auditors', 'Review the evidence, decision, and requirement in one place.', 'proofflow-auditor.webp']
];

export function LandingPage() {
  return <div className="marketing-page">
    <header className="site-header"><Link to="/"><BrandMark /></Link><nav><a href="#why">Why ProofFlow</a><a href="#workflow">How it works</a><a href="#teams">For teams</a></nav><div className="nav-actions"><Link to="/login" className="text-link">Sign in</Link><Link to="/register" className="button button-dark">Start free <ArrowIcon /></Link></div></header>
    <section className="marketing-hero">
      <div className="hero-copy"><p className="eyebrow">Evidence-based work, built for accountability</p><h1>Don’t just mark work done. <span>Prove it.</span></h1><p>ProofFlow connects tasks, evidence, reviews, and audit history—so every completed obligation is defensible.</p><div className="hero-actions"><Link to="/register" className="button button-dark">Create workspace <ArrowIcon /></Link><a href="#workflow" className="button button-lime">See how it works</a></div></div>
      <div className="verification-card"><div className="verification-top"><div><small>Sample review</small><strong>Project Northstar</strong></div><span className="review-state">Under review</span></div><h2>Facility inspection</h2><p>Submission revision 03</p><div className="coverage-row"><span>Evidence coverage</span><strong>4 of 5 requirements</strong></div><div className="meter"><i style={{ width: '80%' }} /></div><div className="sample-evidence"><div><CheckIcon /><span><strong>Signed inspection report</strong><small>PDF · submitted by Jordan Lee</small></span><b>Verified</b></div><div><CheckIcon /><span><strong>Site condition photos</strong><small>8 files · metadata retained</small></span><b>Verified</b></div><div><em>!</em><span><strong>Supervisor sign-off</strong><small>Awaiting reviewer</small></span><b>Pending</b></div></div></div>
    </section>
    <section className="trust-strip" id="why"><p>A checkbox records a claim.</p><h2>ProofFlow records the truth behind it.</h2><p>Required evidence, accountable decisions, immutable revisions, and organization isolation are part of the workflow—not an afterthought.</p></section>
    <section className="chain-section" id="workflow"><p className="eyebrow">The trust chain</p><h2>Completion should leave a trail.</h2><div className="trust-chain">{trustChain.map((step, index) => <article key={step}><span>0{index + 1}</span><h3>{step}</h3><p>{['A real commitment enters the system.','Ownership and timing become explicit.','Required proof is uploaded privately.','An authorized person decides.','Accepted work becomes defensible.','The full history stays retrievable.'][index]}</p></article>)}</div></section>
    <section className="roles-section" id="teams"><div><p className="eyebrow">For every accountable role</p><h2>One shared record. The right view for each decision.</h2></div><div className="role-grid">{roles.map(([label, title, image]) => <article key={label} style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(8,31,26,.82)), url(/images/${image})` }}><p>{label}</p><h3>{title}</h3></article>)}</div></section>
    <section className="final-cta"><p className="eyebrow">Turn accountability into momentum</p><h2>Make “done” mean verified.</h2><Link to="/register" className="button button-lime">Start free <ArrowIcon /></Link></section>
    <footer className="site-footer"><BrandMark inverse /><p>© 2026 ProofFlow. Evidence before assertions.</p></footer>
  </div>;
}
