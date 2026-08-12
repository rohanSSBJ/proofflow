import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorBanner, PageHeader, SuccessBanner } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage, proofFlowApi } from '../lib/api.js';

const roles = ['ADMIN', 'MANAGER', 'CONTRIBUTOR', 'AUDITOR'];

export function MembersPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [invite, setInvite] = useState({ email: '', role: 'CONTRIBUTOR' });
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const members = useQuery({ queryKey: ['members', auth.membership.organizationId], queryFn: () => proofFlowApi.members().then((r) => r.data.members) });
  const canAdmin = auth.role === 'ADMIN';
  const inviteMutation = useMutation({ mutationFn: (input) => proofFlowApi.invite(input), onSuccess: ({ data }) => { const link = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(data.invitationToken)}`; setInviteLink(link); setSuccess('Invitation created. Copy the one-time acceptance link now.'); setInvite({ email: '', role: 'CONTRIBUTOR' }); }, onError: (nextError) => setError(apiErrorMessage(nextError)) });
  const roleMutation = useMutation({ mutationFn: ({ userId, role }) => proofFlowApi.changeRole(userId, role), onSuccess: () => { setSuccess('Member role updated.'); queryClient.invalidateQueries({ queryKey: ['members'] }); }, onError: (nextError) => setError(apiErrorMessage(nextError)) });
  return <div className="page"><PageHeader eyebrow="Organization access" title="Members and roles" description="Roles are enforced by the API at the organization boundary." /><ErrorBanner message={error} /><SuccessBanner message={success} />
    {canAdmin && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Invite member</p><h2>Grant organization access</h2></div></div><form className="inline-form" onSubmit={(e) => { e.preventDefault(); setError(''); setInviteLink(''); inviteMutation.mutate(invite); }}><input type="email" required placeholder="person@company.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /><select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select><button className="button button-dark" disabled={inviteMutation.isPending}>Create invitation</button></form>{inviteLink && <div className="invite-link"><input readOnly value={inviteLink} /><button className="button button-secondary" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</button></div>}</section>}
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Current access</p><h2>{members.data?.length || 0} organization members</h2></div></div><div className="member-table">{members.data?.map((member) => <div key={member.userId}><span className="avatar">{member.user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{member.user.displayName}</strong><small>{member.user.email}</small></div>{canAdmin ? <select value={member.role} disabled={roleMutation.isPending} onChange={(e) => roleMutation.mutate({ userId: member.userId, role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select> : <span className="role-label">{member.role}</span>}</div>)}</div></section>
  </div>;
}
