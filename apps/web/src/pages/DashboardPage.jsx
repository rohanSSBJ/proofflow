import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader, StatusPill } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { proofFlowApi } from '../lib/api.js';

export function DashboardPage() {
  const auth = useAuth();
  const projects = useQuery({ queryKey: ['projects', auth.membership.organizationId], queryFn: () => proofFlowApi.projects().then((r) => r.data.projects) });
  const canReview = ['ADMIN', 'MANAGER', 'AUDITOR'].includes(auth.role);
  const reviews = useQuery({ queryKey: ['reviews', auth.membership.organizationId], queryFn: () => proofFlowApi.reviewQueue().then((r) => r.data.submissions), enabled: canReview });
  const projectList = projects.data || [];
  const queue = reviews.data || [];
  return <div className="page"><PageHeader eyebrow={`${auth.role.toLowerCase()} workspace`} title={`Good work starts with clear proof, ${auth.user.displayName.split(' ')[0]}.`} description="See the records that need action—not just the ones marked complete." />
    <section className="metric-grid"><article><span>Active projects</span><strong>{String(projectList.length).padStart(2, '0')}</strong><small>In {auth.organization.name}</small></article><article><span>Pending reviews</span><strong>{String(canReview ? queue.length : '—').padStart(2, '0')}</strong><small>{canReview ? 'Awaiting a decision' : 'Role-restricted queue'}</small></article><article><span>Evidence model</span><strong>S3</strong><small>Private, signed access</small></article></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Current work</p><h2>Projects</h2></div><Link className="text-link" to="/app/projects">View all →</Link></div>{projects.isLoading ? <p>Loading projects…</p> : projectList.length ? <div className="compact-list">{projectList.slice(0, 5).map((project) => <Link to={`/app/projects/${project.id}`} key={project.id}><div><strong>{project.name}</strong><small>{project.description || 'No description yet'}</small></div><StatusPill status={project.dueDate ? 'ACTIVE' : 'PLANNING'} /></Link>)}</div> : <p className="muted">No projects yet. Admins and managers can create the first one.</p>}</section>
    {canReview && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Assurance</p><h2>Oldest submissions awaiting review</h2></div><Link className="text-link" to="/app/reviews">Open queue →</Link></div>{queue.length ? <div className="compact-list">{queue.slice(0, 4).map((submission) => <Link to="/app/reviews" key={submission.id}><div><strong>{submission.task.title}</strong><small>Revision {submission.revision} · {submission.submittedBy.displayName}</small></div><StatusPill status="SUBMITTED" /></Link>)}</div> : <p className="muted">The review queue is clear.</p>}</section>}
  </div>;
}
