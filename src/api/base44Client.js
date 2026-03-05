import axios from 'axios';

// Helper to determine the backend URL dynamically
export const getBackendUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // If running on standard dev port (5173), assume backend is on 5000 on the same host
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return window.location.origin;
};

export const SOCKET_URL = getBackendUrl();

const api = axios.create({
  baseURL: `${SOCKET_URL}/api`
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Bypass ngrok browser warning for API requests
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.data && error.response.data.message) {
      return Promise.reject(new Error(error.response.data.message));
    }
    return Promise.reject(error);
  }
);

const createEntityClient = (entityName) => ({
  // The backend filtering is basic key-value on query params.
  // This will handle `{ published: true }` and `{ member_email: '...' }`
  filter: (query = {}, sort = '') => {
    // The old client had a sort param, we can ignore it as the backend has default sorting.
    return api.get(`/${entityName}`, { params: query }).then(res => res.data);
  },
  list: () => api.get(`/${entityName}`).then(res => res.data),
  get: (id) => api.get(`/${entityName}/${id}`).then(res => res.data),
  create: (data) => api.post(`/${entityName}`, data).then(res => res.data),
  update: (id, data) => api.put(`/${entityName}/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/${entityName}/${id}`).then(res => res.data),
});

const createChatGroupClient = () => ({
  ...createEntityClient('chat-groups'),
  addMember: (groupId, userId) => api.post(`/chat-groups/${groupId}/members`, { userId }).then(res => res.data),
  removeMember: (groupId, userId) => api.delete(`/chat-groups/${groupId}/members/${userId}`).then(res => res.data),
  leaveGroup: (groupId) => api.delete(`/chat-groups/${groupId}/leave`).then(res => res.data),
  getMyGroups: () => api.get('/chat-groups/mine').then(res => res.data),
});

export const apiClient = {
  auth: {
    login: (credentials) => api.post('/auth/login', credentials).then(res => res.data),
    register: (userData) => api.post('/auth/register', userData).then(res => res.data),
    inviteUser: (email, role) => api.post('/auth/invite', { email, role }).then(res => res.data),
    me: () => api.get('/auth/me').then(res => res.data),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then(res => res.data),
    verifyOtp: (data) => api.post('/auth/verify-otp', data).then(res => res.data),
    resetPassword: (data) => api.post('/auth/reset-password', data).then(res => res.data),
    updateMe: (data) => api.put('/auth/me', data).then(res => res.data),
    isAuthenticated: () => !!localStorage.getItem('token'),
    logout: () => {
      localStorage.removeItem('token');
      window.location.href = '/';
    },
    redirectToLogin: (returnUrl) => {
      const url = returnUrl || window.location.href;
      // You'll need a /login route in your React app
      window.location.href = `/login?returnUrl=${encodeURIComponent(url)}`;
    }
  },
  integrations: {
    Core: {
      UploadFile: ({ file }) => {
        const formData = new FormData();
        formData.append('photo', file); // Server expects 'photo' field
        return api.post('/auth/me/photo', formData).then(res => res.data);
      },
      SendEmail: (data) => {
        return api.post('/core/send-email', data).then(res => res.data);
      }
    }
  },
  entities: {
    User: createEntityClient('users'),
    Sermon: createEntityClient('sermons'),
    Event: createEntityClient('events'),
    Donation: createEntityClient('donations'),
    Announcement: createEntityClient('announcements'),
    MediaItem: createEntityClient('media'),
    ContactMessage: createEntityClient('contact'),
    RSVP: createEntityClient('rsvps'),
    ChatMessage: {
      ...createEntityClient('chatmessages'),
      upload: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/chatmessages/upload', formData).then(res => res.data);
      }
    },
    ChatGroup: createChatGroupClient(),
  }
};