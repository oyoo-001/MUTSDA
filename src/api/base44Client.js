import axios from 'axios';

// Helper to determine the backend URL dynamically
export const getBackendUrl = () => {
  // In development, use local backend
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  // In production, use the production backend
  return 'https://mutsda.onrender.com';
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
  // Get all items - backend returns { success: true, data: [...], count: N }
  list: () => api.get(`/${entityName}`).then(res => res.data),
  
  // Filter with query params (not all endpoints support this)
  filter: (query = {}, sort = '') => {
    return api.get(`/${entityName}`, { params: query }).then(res => res.data);
  },
  
  // Get single item - backend returns { success: true, data: {...} }
  get: (id) => api.get(`/${entityName}/${id}`).then(res => res.data?.data || res.data),
  
  // Create item - backend returns { success: true, data: {...} }
  create: (data) => api.post(`/${entityName}`, data).then(res => res.data?.data || res.data),
  
  // Update item - backend returns { success: true, data: {...} }
  update: (id, data) => api.put(`/${entityName}/${id}`, data).then(res => res.data?.data || res.data),
  
  // Delete item - backend returns { success: true, message: '...', data: null }
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
  // Expose the raw axios instance for custom calls or debugging
  api: api,
  
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
      window.location.href = `/login?returnUrl=${encodeURIComponent(url)}`;
    }
  },
  integrations: {
    Core: {
      UploadFile: ({ file }) => {
        const formData = new FormData();
        formData.append('photo', file); 
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
    Harambee: createEntityClient('harambees'),
    RSVP: createEntityClient('rsvps'),
    
    // Updated DirectMessage Entity to handle DM history
    DirectMessage: {
      getHistory: (channelId) => {
        // Points to dmRouter: GET /api/dm/:channelId
        return api.get(`/dm/${channelId}`).then(res => res.data);
      },
      markAsRead: (channelId) => {
        // Points to dmRouter: PATCH /api/dm/:channelId/read
        return api.patch(`/dm/${channelId}/read`).then(res => res.data);
      }
    },

    ChatMessage: {
      ...createEntityClient('chatmessages'),
      upload: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/chatmessages/upload', formData).then(res => res.data);
      }
    },
    ChatGroup: createChatGroupClient(),
  },
  aiChat: {
    send: (message, history = []) => api.post('/ai-chat', { message, history }).then(res => res.data),
    getHistory: () => api.get('/ai-chat/history').then(res => res.data),
    clearHistory: () => api.delete('/ai-chat/history').then(res => res.data),
  },
};