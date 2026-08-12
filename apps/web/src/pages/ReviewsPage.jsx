import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorBanner, PageHeader, StatusPill, SuccessBanner } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage, proofFlowApi } from '../lib/api.js';

export function ReviewsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const queue = useQuery({ queryKey: ['reviews', auth.membership.organizationId], queryFn: () => proofFlowApi.reviewQueue().then((r) => r.data.submissions) });
  const decide = useMutation({ mutationFn: async ({ submission, decision, verify }) => {
    await proofFlowApi.review(submission.id, { decision, ...(decision === 'REJECTED' ? { reason: reasons[submission.id] } : {}) });
    if (verify) await proofFlowApi.verify(submission.id);
  }, onSuccess: (_, variables) => { setError(''); setSuccess(variables.verify ? 'Evidence approved and task verified.' : variables.decision === 'APPROVED' ? 'Evidence approved.' : 'Evidence rejected with an actionable reason.'); queryClient.invalidateQueries({ queryKey: ['reviews'] }); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }, onError: (nextError) => setError(apiErrorMessage(nextError)) });
  const openEvidence = async (submission, item) => { try { const { data } = await proofFlowApi.downloadEvidence(submission.task.projectId, submission.task.id, item.evidenceFile.id); window.open(data.download.url, '_blank', 'noopener,noreferrer'); } catch (nextError) { setError(apiErrorMessage(nextError)); } };
  const canVerify = ['ADMIN', 'AUDITOR'].includes(auth.role);
  return <div className="page"><PageHeader eyebrow="Accountable review" title="Evidence review queue" description="Decide against the exact submitted revision. Rejections retain their reason and lead to a new revision." /><ErrorBanner message={error} /><SuccessBanner message={success} />
    {queue.isLoading ? <div className="center-state"><span className="spinner" /> Loading submissions…</div> : queue.data?.length ? <div className="review-grid">{queue.data.map((submission) => <article className="review-card" key={submission.id}><header><div><p className="eyebrow">Revision {submission.revision}</p><h2>{submission.task.title}</h2><p>Submitted by {submission.submittedBy.displayName} · {new Date(submission.submittedAt).toLocaleString()}</p></div><StatusPill status={submission.status} /></header>{submission.notes && <blockquote>{submission.notes}</blockquote>}<div className="review-evidence">{submission.items.map((item) => <button type="button" onClick={() => openEvidence(submission, item)} key={item.evidenceFileId}><span>↗</span><div><strong>{item.evidenceFile.originalName}</strong><small>{item.requirement?.label || 'Supporting evidence'} · {(item.evidenceFile.byteSize / 1024).toFixed(1)} KB</small></div></button>)}</div><label>Rejection reason<textarea placeholder="Required when rejecting; explain what must change." value={reasons[submission.id] || ''} onChange={(e) => setReasons({ ...reasons, [submission.id]: e.target.value })} /></label><div className="review-actions"><button className="button button-danger" disabled={!reasons[submission.id]?.trim() || decide.isPending} onClick={() => decide.mutate({ submission, decision: 'REJECTED' })}>Reject with reason</button><button className="button button-secondary" disabled={decide.isPending} onClick={() => decide.mutate({ submission, decision: 'APPROVED' })}>Approve</button>{canVerify && <button className="button button-dark" disabled={decide.isPending} onClick={() => decide.mutate({ submission, decision: 'APPROVED', verify: true })}>Approve & verify</button>}</div></article>)}</div> : <div className="empty-state"><span>✓</span><h2>Review queue clear</h2><p>No submitted evidence is waiting for a decision.</p></div>}
  </div>;
}
