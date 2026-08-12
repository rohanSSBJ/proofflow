import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiErrorMessage, clearApiSession, proofFlowApi, setAccessToken, setOrganizationId } from '../lib/api.js';

const AuthContext = createContext(null);

function preferredMembership(user, preferredId) {
  return user?.memberships?.find((membership) => membership.organizationId === preferredId) || user?.memberships?.[0] || null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const applyUser = useCallback((nextUser) => {
    const preferredId = window.localStorage.getItem('proofflow_organization_id');
    const nextMembership = preferredMembership(nextUser, preferredId);
    setUser(nextUser);
    setMembership(nextMembership);
    setOrganizationId(nextMembership?.organizationId);
    if (nextMembership) window.localStorage.setItem('proofflow_organization_id', nextMembership.organizationId);
  }, []);

  const establish = useCallback((payload) => {
    setAccessToken(payload.accessToken);
    applyUser(payload.user);
    setNotice('');
  }, [applyUser]);

  const signOutLocal = useCallback(() => {
    clearApiSession();
    setUser(null);
    setMembership(null);
  }, []);

  useEffect(() => {
    let active = true;
    proofFlowApi.refresh()
      .then(({ data }) => {
        if (!active) return;
        setAccessToken(data.accessToken);
        return proofFlowApi.me();
      })
      .then((response) => { if (active && response) applyUser(response.data.user); })
      .catch(() => { if (active) signOutLocal(); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyUser, signOutLocal]);

  useEffect(() => {
    const expire = () => {
      signOutLocal();
      setNotice('Your session expired. Sign in again to continue.');
    };
    window.addEventListener('proofflow:session-expired', expire);
    return () => window.removeEventListener('proofflow:session-expired', expire);
  }, [signOutLocal]);

  const login = async (input) => {
    const { data } = await proofFlowApi.login(input);
    establish(data);
  };

  const register = async (input) => {
    const { data } = await proofFlowApi.register(input);
    establish(data);
  };

  const acceptInvitation = async (input) => {
    const { data } = await proofFlowApi.acceptInvitation(input);
    establish(data);
  };

  const logout = async () => {
    try { await proofFlowApi.logout(); } finally { signOutLocal(); }
  };

  const selectOrganization = (organizationId) => {
    const next = preferredMembership(user, organizationId);
    setMembership(next);
    setOrganizationId(next?.organizationId);
    if (next) window.localStorage.setItem('proofflow_organization_id', next.organizationId);
  };

  const value = useMemo(() => ({
    user,
    membership,
    role: membership?.role,
    organization: membership?.organization,
    loading,
    notice,
    setNotice,
    login,
    register,
    acceptInvitation,
    logout,
    selectOrganization,
    errorMessage: apiErrorMessage
  }), [user, membership, loading, notice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
