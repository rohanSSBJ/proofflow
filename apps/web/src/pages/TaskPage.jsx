import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner, PageHeader, StatusPill, SuccessBanner } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage, proofFlowApi, uploadEvidenceFile } from '../lib/api.js';

export function TaskPage() {
  const { projectId, taskId } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [requirement, setRequirement] = useState({ label: '', description: '', minItems: 1 });
  const [files, setFiles] = useState({});
  const [notes, setNotes] = useState('');
  const tasks = useQuery({ queryKey: ['tasks', auth.membership.organizationId, projectId], queryFn: () => proofFlowApi.tasks(projectId).then((r) => r.data.tasks) });
  const members = useQuery({ queryKey: ['members', auth.membership.organizationId], queryFn: () => proofFlowApi.members().then((r) => r.data.members) });
  const requirements = useQuery({ queryKey: ['requirements', auth.membership.organizationId, projectId, taskId], queryFn: () => proofFlowApi.requirements(projectId, taskId).then((r) => r.data.requirements) });
  const task = tasks.data?.find((item) => item.id === taskId);
  const canManage = ['ADMIN', 'MANAGER'].includes(auth.role);
  const canWork = canManage || task?.assignments.some((item) => item.userId === auth.user.id);
  const refreshTask = () => queryClient.invalidateQueries({ queryKey: ['tasks', auth.membership.organizationId, projectId] });

  const action = useMutation({ mutationFn: async ({ type, payload }) => {
    if (type === 'assign') return proofFlowApi.assignTask(projectId, taskId, payload);
    if (type === 'transition') return proofFlowApi.transitionTask(projectId, taskId, payload);
    if (type === 'requirement') return proofFlowApi.createRequirement(projectId, taskId, payload);
  }, onSuccess: (_, variables) => { setError(''); setSuccess('Workflow updated.'); refreshTask(); if (variables.type === 'requirement') { requirements.refetch(); setRequirement({ label: '', description: '', minItems: 1 }); } }, onError: (nextError) => setError(apiErrorMessage(nextError)) });

  const submitEvidence = useMutation({ mutationFn: async () => {
    const requirementList = requirements.data || [];
    const selections = requirementList.length ? requirementList.flatMap((item) => {
      const selected = files[item.id];
      return selected ? [{ requirement: item, file: selected }] : [];
    }) : files.general ? [{ requirement: null, file: files.general }] : [];
    if (!selections.length) throw new Error('Choose at least one evidence file.');
    for (const required of requirementList.filter((item) => item.mandatory)) {
      if (!files[required.id]) throw new Error(`Choose evidence for “${required.label}”.`);
    }
    const evidenceFiles = [];
    for (const selection of selections) {
      const evidence = await uploadEvidenceFile(projectId, taskId, selection.file);
      evidenceFiles.push({ evidenceFileId: evidence.id, ...(selection.requirement ? { requirementId: selection.requirement.id } : {}) });
    }
    return proofFlowApi.submitEvidence(projectId, taskId, { notes: notes || undefined, items: evidenceFiles });
  }, onSuccess: () => { setError(''); setSuccess('Evidence uploaded privately and submitted for review.'); setFiles({}); setNotes(''); refreshTask(); }, onError: (nextError) => setError(apiErrorMessage(nextError, 'Evidence could not be submitted.')) });

  const transitionOptions = useMemo(() => {
    if (!task) return [];
    if (task.status === 'DRAFT' && canManage) return [['ASSIGNED', 'Mark assigned']];
    if (task.status === 'ASSIGNED') return [['IN_PROGRESS', 'Start work']];
    if (task.status === 'REJECTED') return [['IN_PROGRESS', 'Resume work']];
    return [];
  }, [task, canManage]);

  if (!task && !tasks.isLoading) return <div className="page"><p>Task not found.</p></div>;
  return <div className="page"><Link className="back-link" to={`/app/projects/${projectId}`}>← Project tasks</Link><PageHeader eyebrow="Evidence-backed task" title={task?.title || 'Loading task…'} description={task?.description || 'This task becomes complete only after its evidence is approved and verified.'} actions={task && <StatusPill status={task.status} />} />
    <ErrorBanner message={error} /><SuccessBanner message={success} />
    {task && <div className="task-workspace">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Ownership</p><h2>Assignment and state</h2></div></div><p className="muted">{task.assignments.length ? task.assignments.map((item) => `${item.user.displayName} (${item.user.email})`).join(', ') : 'No contributor assigned.'}</p>{canManage && <div className="inline-form"><select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Select organization member</option>{members.data?.map((item) => <option key={item.userId} value={item.userId}>{item.user.displayName} · {item.role}</option>)}</select><button className="button button-secondary" disabled={!assigneeId || action.isPending} onClick={() => action.mutate({ type: 'assign', payload: assigneeId })}>Assign</button></div>}<div className="action-row">{transitionOptions.map(([to, label]) => <button className="button button-dark" key={to} disabled={action.isPending} onClick={() => action.mutate({ type: 'transition', payload: to })}>{label}</button>)}</div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Required proof</p><h2>Evidence requirements</h2></div></div>{requirements.data?.length ? <div className="requirement-list">{requirements.data.map((item) => <div key={item.id}><div><strong>{item.label}</strong><small>{item.description || `${item.minItems} item(s) required`}</small></div><span>{item.mandatory ? 'Mandatory' : 'Optional'}</span></div>)}</div> : <p className="muted">No specific requirements yet.</p>}{canManage && <form className="inline-form requirement-form" onSubmit={(e) => { e.preventDefault(); action.mutate({ type: 'requirement', payload: { ...requirement, minItems: Number(requirement.minItems), mandatory: true } }); }}><input required minLength="2" placeholder="Requirement label" value={requirement.label} onChange={(e) => setRequirement({ ...requirement, label: e.target.value })} /><input placeholder="Description" value={requirement.description} onChange={(e) => setRequirement({ ...requirement, description: e.target.value })} /><input type="number" min="1" max="20" value={requirement.minItems} onChange={(e) => setRequirement({ ...requirement, minItems: e.target.value })} /><button className="button button-secondary">Add requirement</button></form>}</section>
      <section className="panel evidence-panel"><div className="panel-heading"><div><p className="eyebrow">Submit proof</p><h2>Private evidence upload</h2></div><span className="private-badge">S3 · signed URL</span></div>{canWork && ['IN_PROGRESS', 'REJECTED'].includes(task.status) ? <form className="form-stack" onSubmit={(e) => { e.preventDefault(); submitEvidence.mutate(); }}>{requirements.data?.length ? requirements.data.map((item) => <label key={item.id}>{item.label} {item.mandatory && <b>*</b>}<input type="file" required={item.mandatory} onChange={(e) => setFiles({ ...files, [item.id]: e.target.files?.[0] })} /></label>) : <label>Evidence file<input type="file" required onChange={(e) => setFiles({ ...files, general: e.target.files?.[0] })} /></label>}<label>Submission notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain what this evidence proves and any relevant context." /></label><button className="button button-lime" disabled={submitEvidence.isPending}>{submitEvidence.isPending ? 'Uploading and submitting…' : task.status === 'REJECTED' ? 'Submit corrected revision' : 'Submit evidence for review'}</button><small>Maximum 25 MB per file. The API verifies object size and content type before accepting the submission.</small></form> : <p className="muted">{task.status === 'DRAFT' ? 'Assign the task and start work before submitting evidence.' : task.status === 'ASSIGNED' ? 'Start work before submitting evidence.' : task.status === 'EVIDENCE_SUBMITTED' ? 'Evidence is awaiting an accountable review.' : task.status === 'APPROVED' ? 'Evidence is approved and awaiting final verification.' : task.status === 'VERIFIED' ? 'This task has a verified outcome.' : 'Evidence upload is unavailable in the current state.'}</p>}</section>
    </div>}
  </div>;
}
