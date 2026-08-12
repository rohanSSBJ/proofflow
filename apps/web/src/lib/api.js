import axios from 'axios';

let accessToken = null;
let organizationId = null;
let refreshPromise = null;

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { Accept: 'application/json' }
});

export function setAccessToken(token) {
  accessToken = token || null;
}

export function setOrganizationId(id) {
  organizationId = id || null;
}

export function clearApiSession() {
  accessToken = null;
  organizationId = null;
}

export function apiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || error?.message || fallback;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (organizationId) config.headers['X-Organization-Id'] = organizationId;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute = original?.url?.startsWith('/auth/');
    if (error.response?.status !== 401 || original?._retried || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retried = true;
    refreshPromise ||= api.post('/auth/refresh', {}, { _retried: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .finally(() => { refreshPromise = null; });

    try {
      const token = await refreshPromise;
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (refreshError) {
      clearApiSession();
      window.dispatchEvent(new Event('proofflow:session-expired'));
      return Promise.reject(refreshError);
    }
  }
);

export const proofFlowApi = {
  register: (input) => api.post('/auth/register', input),
  login: (input) => api.post('/auth/login', input),
  acceptInvitation: (input) => api.post('/auth/accept-invitation', input),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  organizations: () => api.get('/organizations'),
  members: () => api.get('/organizations/members'),
  invitations: () => api.get('/organizations/invitations'),
  invite: (input) => api.post('/organizations/invitations', input),
  changeRole: (userId, role) => api.patch(`/organizations/members/${userId}/role`, { role }),
  projects: () => api.get('/projects'),
  createProject: (input) => api.post('/projects', input),
  tasks: (projectId) => api.get(`/projects/${projectId}/tasks`),
  createMilestone: (projectId, input) => api.post(`/projects/${projectId}/milestones`, input),
  createTask: (projectId, input) => api.post(`/projects/${projectId}/tasks`, input),
  assignTask: (projectId, taskId, userId) => api.post(`/projects/${projectId}/tasks/${taskId}/assignments`, { userId }),
  transitionTask: (projectId, taskId, to, reason) => api.post(`/projects/${projectId}/tasks/${taskId}/transitions`, { to, ...(reason ? { reason } : {}) }),
  requirements: (projectId, taskId) => api.get(`/projects/${projectId}/tasks/${taskId}/evidence-requirements`),
  createRequirement: (projectId, taskId, input) => api.post(`/projects/${projectId}/tasks/${taskId}/evidence-requirements`, input),
  authorizeEvidence: (projectId, taskId, input) => api.post(`/projects/${projectId}/tasks/${taskId}/evidence`, input),
  submitEvidence: (projectId, taskId, input) => api.post(`/projects/${projectId}/tasks/${taskId}/submissions`, input),
  downloadEvidence: (projectId, taskId, evidenceId) => api.get(`/projects/${projectId}/tasks/${taskId}/evidence/${evidenceId}/download-url`),
  reviewQueue: () => api.get('/reviews/queue'),
  review: (submissionId, input) => api.post(`/submissions/${submissionId}/reviews`, input),
  verify: (submissionId) => api.post(`/submissions/${submissionId}/verify`, {})
};

export async function uploadEvidenceFile(projectId, taskId, file) {
  const { data } = await proofFlowApi.authorizeEvidence(projectId, taskId, {
    originalName: file.name,
    contentType: file.type || 'application/octet-stream',
    byteSize: file.size
  });
  await axios.put(data.upload.url, file, { headers: data.upload.headers });
  return data.evidence;
}
