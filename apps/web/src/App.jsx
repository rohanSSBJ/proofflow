import { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export default function App() {
  const [health, setHealth] = useState({ state: 'checking', message: 'Checking API…' });

  useEffect(() => {
    api.get('/health/live')
      .then(({ data }) => setHealth({ state: 'online', message: `${data.service} is live` }))
      .catch(() => setHealth({ state: 'offline', message: 'API is not reachable yet' }));
  }, []);

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span className="brand-mark">P</span> ProofFlow</div>
        <span className="stage-pill">Foundation build</span>
      </nav>

      <section className="hero">
        <div className="eyebrow">Evidence-based work management</div>
        <h1>Turn work into proof.</h1>
        <p className="lede">
          ProofFlow connects obligations, execution, evidence, review, and auditable outcomes.
        </p>
        <div className={`health health-${health.state}`}>
          <span className="health-dot" /> {health.message}
        </div>
      </section>

      <section className="workflow" aria-label="ProofFlow workflow">
        {['Assigned', 'In progress', 'Evidence', 'Review', 'Verified'].map((step, index) => (
          <div className="workflow-step" key={step}>
            <span className="step-number">0{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </section>

      <section className="cards">
        <article className="card card-dark">
          <span className="card-kicker">Now building</span>
          <h2>Trustworthy task foundation</h2>
          <p>Tenant isolation, role-aware planning, task history, and deployment health are the first layer.</p>
        </article>
        <article className="card">
          <span className="card-kicker">Next</span>
          <h2>Evidence workflow</h2>
          <p>Immutable evidence revisions, review decisions, rejection reasons, and verification transitions.</p>
        </article>
      </section>
    </main>
  );
}
