import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner, Modal, PageHeader, StatusPill } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage, proofFlowApi } from '../lib/api.js';

export function ProjectPage() {
  const { projectId } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ title: '', description: '', dueDate: '', weight: 1 });
  const [error, setError] = useState('');
  const projects = useQuery({ queryKey: ['projects', auth.membership.organizationId], queryFn: () => proofFlowApi.projects().then((r) => r.data.projects) });
  const tasks = useQuery({ queryKey: ['tasks', auth.membership.organizationId, projectId], queryFn: () => proofFlowApi.tasks(projectId).then((r) => r.data.tasks) });
  const project = projects.data?.find((item) => item.id === projectId);
  const create = useMutation({ mutationFn: (input) => proofFlowApi.createTask(projectId, input), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks', auth.membership.organizationId, projectId] }); setOpen(false); setValues({ title: '', description: '', dueDate: '', weight: 1 }); }, onError: (nextError) => setError(apiErrorMessage(nextError)) });
  const canCreate = ['ADMIN', 'MANAGER'].includes(auth.role);
  const submit = (event) => { event.preventDefault(); create.mutate({ ...values, dueDate: values.dueDate || undefined, weight: Number(values.weight) }); };
  return <div className="page"><Link className="back-link" to="/app/projects">← Projects</Link><PageHeader eyebrow="Project record" title={project?.name || 'Project'} description={project?.description || 'Tasks become verified only through required evidence and accountable review.'} actions={canCreate && <button className="button button-dark" onClick={() => setOpen(true)}>New task</button>} />
    <div className="task-list">{tasks.isLoading ? <p>Loading tasks…</p> : tasks.data?.length ? tasks.data.map((task) => <Link to={`/app/projects/${projectId}/tasks/${task.id}`} className="task-row" key={task.id}><div><span className="task-weight">W{task.weight}</span><div><h2>{task.title}</h2><p>{task.description || 'No description'} · {task.assignments.length ? task.assignments.map((item) => item.user.displayName).join(', ') : 'Unassigned'}</p></div></div><div><StatusPill status={task.status} /><span>→</span></div></Link>) : <div className="empty-inline">No tasks yet. {canCreate && 'Create the first obligation for this project.'}</div>}</div>
    {open && <Modal title="Create task" onClose={() => setOpen(false)}><ErrorBanner message={error} /><form className="form-grid" onSubmit={submit}><label className="wide">Task title<input required minLength="2" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} /></label><label className="wide">Description<textarea value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} /></label><label>Due date<input type="date" value={values.dueDate} onChange={(e) => setValues({ ...values, dueDate: e.target.value })} /></label><label>Progress weight<input type="number" min="1" max="1000" value={values.weight} onChange={(e) => setValues({ ...values, weight: e.target.value })} /></label><button className="button button-dark wide" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create task'}</button></form></Modal>}
  </div>;
}
