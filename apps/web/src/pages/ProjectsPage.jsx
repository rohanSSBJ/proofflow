import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBanner, Modal, PageHeader } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage, proofFlowApi } from '../lib/api.js';

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64); }

export function ProjectsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: '', description: '', dueDate: '', budget: '' });
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['projects', auth.membership.organizationId], queryFn: () => proofFlowApi.projects().then((r) => r.data.projects) });
  const create = useMutation({ mutationFn: (input) => proofFlowApi.createProject(input), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setOpen(false); setValues({ name: '', description: '', dueDate: '', budget: '' }); }, onError: (nextError) => setError(apiErrorMessage(nextError)) });
  const canCreate = ['ADMIN', 'MANAGER'].includes(auth.role);
  const submit = (event) => { event.preventDefault(); setError(''); create.mutate({ name: values.name, slug: slugify(values.name), description: values.description || undefined, dueDate: values.dueDate || undefined, budgetMinor: values.budget ? String(Math.round(Number(values.budget) * 100)) : undefined, currency: 'INR' }); };
  return <div className="page"><PageHeader eyebrow="Planning" title={auth.role === 'CONTRIBUTOR' ? 'My project work' : 'Projects'} description="Projects organize milestones, tasks, evidence, and accountable outcomes." actions={canCreate && <button className="button button-dark" onClick={() => setOpen(true)}>New project</button>} />
    {query.isLoading ? <div className="center-state"><span className="spinner" /> Loading projects…</div> : query.data?.length ? <div className="project-grid">{query.data.map((project) => <Link className="project-card" to={`/app/projects/${project.id}`} key={project.id}><div className="project-card-top"><span>{project.currency}</span><small>{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'No deadline'}</small></div><h2>{project.name}</h2><p>{project.description || 'Add tasks and evidence requirements to begin this project.'}</p><div><strong>{project.budgetMinor ? `₹${(Number(project.budgetMinor) / 100).toLocaleString('en-IN')}` : 'Budget not set'}</strong><span>Open project →</span></div></Link>)}</div> : <EmptyState title="No projects yet" body={canCreate ? 'Create the first project and turn its obligations into verifiable tasks.' : 'An admin or manager has not assigned project work yet.'} action={canCreate && <button className="button button-dark" onClick={() => setOpen(true)}>Create project</button>} />}
    {open && <Modal title="Create project" onClose={() => setOpen(false)}><ErrorBanner message={error} /><form className="form-grid" onSubmit={submit}><label className="wide">Project name<input required minLength="2" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></label><label className="wide">Description<textarea value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} /></label><label>Deadline<input type="date" value={values.dueDate} onChange={(e) => setValues({ ...values, dueDate: e.target.value })} /></label><label>Budget (INR)<input type="number" min="0" value={values.budget} onChange={(e) => setValues({ ...values, budget: e.target.value })} /></label><button className="button button-dark wide" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create project'}</button></form></Modal>}
  </div>;
}
