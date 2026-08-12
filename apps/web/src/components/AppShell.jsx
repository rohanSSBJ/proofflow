import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandMark } from './BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const roleLinks = {
  ADMIN: [['Overview', '/app'], ['Projects', '/app/projects'], ['Reviews', '/app/reviews'], ['Members', '/app/members']],
  MANAGER: [['Overview', '/app'], ['Projects', '/app/projects'], ['Reviews', '/app/reviews'], ['Members', '/app/members']],
  CONTRIBUTOR: [['My work', '/app'], ['Projects', '/app/projects']],
  AUDITOR: [['Review queue', '/app/reviews'], ['Projects', '/app/projects'], ['Members', '/app/members']]
};

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const links = roleLinks[auth.role] || roleLinks.CONTRIBUTOR;
  const initials = auth.user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const signOut = async () => {
    await auth.logout();
    navigate('/');
  };

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <NavLink to="/app" className="app-brand"><BrandMark inverse /></NavLink>
        <div className="workspace-card">
          <small>Active workspace</small>
          <strong>{auth.organization?.name}</strong>
          {auth.user.memberships.length > 1 && (
            <select value={auth.membership.organizationId} onChange={(event) => { auth.selectOrganization(event.target.value); navigate('/app'); }}>
              {auth.user.memberships.map((item) => <option value={item.organizationId} key={item.organizationId}>{item.organization.name}</option>)}
            </select>
          )}
        </div>
        <nav className="app-nav">
          {links.map(([label, to]) => <NavLink key={to} to={to} end={to === '/app'}>{label}</NavLink>)}
        </nav>
        <div className="sidebar-footer"><span className="avatar">{initials}</span><div><strong>{auth.user.displayName}</strong><small>{auth.role}</small></div><button type="button" onClick={signOut}>Sign out</button></div>
      </aside>
      <main className="app-content"><Outlet /></main>
    </div>
  );
}
