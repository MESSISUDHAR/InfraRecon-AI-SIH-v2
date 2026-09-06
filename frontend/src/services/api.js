import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Schedule APIs
export const uploadSchedule = async (formData) => {
  const response = await axios.post('/api/schedule/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getScheduleActivities = async (params = {}) => {
  const response = await api.get('/schedule/activities', { params });
  return response.data;
};

export const getScheduleSummary = async (params = {}) => {
  const response = await api.get('/schedule/summary', { params });
  return response.data;
};

export const getScheduleVersions = async (params = {}) => {
  const response = await api.get('/schedule/versions', { params });
  return response.data;
};

// Projects APIs
export const getProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await api.post('/projects', projectData);
  return response.data;
};

// Execution Events (Milestone 3 Evidence Ingestion APIs)
export const submitExecutionEvent = async (eventData) => {
  const response = await api.post('/execution-events/submit', eventData);
  return response.data;
};

export const uploadExecutionFile = async (formData) => {
  const response = await axios.post('/api/execution-events/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getExecutionEvents = async (params = {}) => {
  const response = await api.get('/execution-events', { params });
  return response.data;
};

export const getExecutionEvent = async (eventId) => {
  const response = await api.get(`/execution-events/${eventId}`);
  return response.data;
};

export const deleteExecutionEvent = async (eventId) => {
  const response = await api.delete(`/execution-events/${eventId}`);
  return response.data;
};

// Milestone 4: Gemini Structured Extraction APIs
export const extractExecutionEvent = async (payload) => {
  const response = await api.post('/execution-events/extract', payload);
  return response.data;
};

export const extractEventById = async (eventId) => {
  const response = await api.post(`/execution-events/${eventId}/extract`);
  return response.data;
};

// Milestone 5: Semantic Embedding & Top-K Search APIs
export const searchActivitiesSemantic = async (searchPayload) => {
  const response = await api.post('/schedule/semantic-search', searchPayload);
  return response.data;
};

export const generateScheduleEmbeddings = async (params = {}) => {
  const response = await api.post('/schedule/generate-embeddings', null, { params });
  return response.data;
};

// Milestone 6: Candidate Activity Retrieval APIs
export const retrieveCandidates = async (payload) => {
  const response = await api.post('/matches/retrieve-candidates', payload);
  return response.data;
};

export const getCandidatesForEvent = async (eventId, params = {}) => {
  const response = await api.get(`/matches/candidates/${eventId}`, { params });
  return response.data;
};

export const getMatchesStatus = async () => {
  const response = await api.get('/matches/status');
  return response.data;
};

// Milestone 7: Context-Aware L5/L6 Reconciliation APIs
export const reconcileEvent = async (payload) => {
  const response = await api.post('/matches/reconcile', payload);
  return response.data;
};

export const getReconciliationForEvent = async (eventId, params = {}) => {
  const response = await api.get(`/matches/reconcile/${eventId}`, { params });
  return response.data;
};

export const getReconciliationWeights = async () => {
  const response = await api.get('/matches/weights');
  return response.data;
};

// Milestone 8: Human-in-the-Loop Planner Review APIs
export const getReviewQueue = async (params = {}) => {
  const response = await api.get('/review/queue', { params });
  return response.data;
};

export const approveReviewMatch = async (payload) => {
  const response = await api.post('/review/approve', payload);
  return response.data;
};

export const selectReviewCandidate = async (payload) => {
  const response = await api.post('/review/select-candidate', payload);
  return response.data;
};

export const rejectReviewMatch = async (payload) => {
  const response = await api.post('/review/reject', payload);
  return response.data;
};

export const autoProcessReviewQueue = async (payload) => {
  const response = await api.post('/review/auto-process', payload);
  return response.data;
};

export const getConfidencePolicy = async () => {
  const response = await api.get('/review/policy');
  return response.data;
};

export const setConfidencePolicy = async (payload) => {
  const response = await api.post('/review/policy', payload);
  return response.data;
};

// Milestone 9: Verified Execution State & Observation Lineage APIs
export const getExecutionStateSummary = async (projectId = 'PRJ-REF-04') => {
  const response = await api.get('/execution-state/summary', { params: { project_id: projectId } });
  return response.data;
};

export const getExecutionStateList = async (params = {}) => {
  const response = await api.get('/execution-state/list', { params });
  return response.data;
};

export const getActivityExecutionStateDetail = async (activityId, projectId = 'PRJ-REF-04') => {
  const response = await api.get(`/execution-state/activity/${activityId}`, { params: { project_id: projectId } });
  return response.data;
};

export const getExecutionStateStatus = async () => {
  const response = await api.get('/execution-state/status');
  return response.data;
};

// Milestone 10: Evidence and Audit Trail Lineage APIs
export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/audit/logs', { params });
  return response.data;
};

export const getAuditLogDetail = async (auditId) => {
  const response = await api.get(`/audit/logs/${auditId}`);
  return response.data;
};

export const getAuditStats = async (projectId = 'PRJ-REF-04') => {
  const response = await api.get('/audit/stats', { params: { project_id: projectId } });
  return response.data;
};

export const getAuditStatus = async () => {
  const response = await api.get('/audit/status');
  return response.data;
};

// Milestone 11: Project Intelligence Dashboard APIs
export const getDashboardSummary = async (projectId = 'PRJ-REF-04') => {
  const response = await api.get('/dashboard/summary', { params: { project_id: projectId } });
  return response.data;
};

export const getDashboardStatus = async () => {
  const response = await api.get('/dashboard/status');
  return response.data;
};

// Milestone 12: Dependency Intelligence APIs
export const getDependencyImpactSummary = async (projectId = 'PRJ-REF-04') => {
  const response = await api.get('/dependencies/impact-summary', { params: { project_id: projectId } });
  return response.data;
};

export const getActivityDependencyDetail = async (activityId, projectId = 'PRJ-REF-04') => {
  const response = await api.get(`/dependencies/activity/${activityId}`, { params: { project_id: projectId } });
  return response.data;
};

export const getDependencyStatus = async () => {
  const response = await api.get('/dependencies/status');
  return response.data;
};

export default api;




