import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark.jsx';
import { ErrorBanner } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function AuthLayout({ eyebrow, title, description, children, alternate }) {
  return <div className="auth-page"><aside className="auth-story"><Link to="/"><BrandMark inverse /></Link><div><p className="eyebrow">Evidence before assertions</p><h2>Build a record that can stand up to review.</h2><ul><li>Define evidence before work begins</li><li>Review the exact submitted revision</li><li>Preserve every accountable decision</li></ul></div></aside><main className="auth-panel"><div className="auth-panel-top"><Link to="/">← Home</Link>{alternate}</div><section className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p>{children}</section></main></div>;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState(auth.notice);
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to="/app" replace />;
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await auth.login(values); navigate(location.state?.from || '/app', { replace: true }); } catch (nextError) { setError(auth.errorMessage(nextError)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="Welcome back" title="Sign in to ProofFlow" description="Continue to your organization’s verified work record." alternate={<span>New here? <Link to="/register">Create workspace</Link></span>}><ErrorBanner message={error} /><form className="form-stack" onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label><label>Password<input type="password" required autoComplete="current-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /></label><button className="button button-dark" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></AuthLayout>;
}

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ displayName: '', email: '', organizationName: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to="/app" replace />;
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await auth.register(values); navigate('/app', { replace: true }); } catch (nextError) { setError(auth.errorMessage(nextError)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="Create your workspace" title="Start with accountable work" description="Your first account becomes the organization administrator." alternate={<span>Already registered? <Link to="/login">Sign in</Link></span>}><ErrorBanner message={error} /><form className="form-grid" onSubmit={submit}><label>Full name<input required minLength="2" autoComplete="name" value={values.displayName} onChange={(e) => setValues({ ...values, displayName: e.target.value })} /></label><label>Work email<input type="email" required autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label><label className="wide">Organization<input required minLength="2" autoComplete="organization" value={values.organizationName} onChange={(e) => setValues({ ...values, organizationName: e.target.value })} /></label><label className="wide">Password <small>At least 12 characters</small><input type="password" required minLength="12" autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /></label><button className="button button-dark wide" disabled={busy}>{busy ? 'Creating workspace…' : 'Create workspace'}</button></form></AuthLayout>;
}

export function InvitationPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [values, setValues] = useState({ token: params.get('token') || '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await auth.acceptInvitation(values); navigate('/app', { replace: true }); } catch (nextError) { setError(auth.errorMessage(nextError)); } finally { setBusy(false); } };
  return <AuthLayout eyebrow="Organization invitation" title="Join your ProofFlow workspace" description="Use the invitation token shared by your administrator." alternate={<Link to="/login">Sign in</Link>}><ErrorBanner message={error} /><form className="form-stack" onSubmit={submit}><label>Invitation token<input required value={values.token} onChange={(e) => setValues({ ...values, token: e.target.value })} /></label><label>Your name<input required minLength="2" autoComplete="name" value={values.displayName} onChange={(e) => setValues({ ...values, displayName: e.target.value })} /></label><label>Create password<input type="password" required minLength="12" autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /></label><button className="button button-dark" disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</button></form></AuthLayout>;
}
