import axios from 'axios';

const TOKEN_KEY = 'infra_token';
const USER_KEY = 'infra_user';

export const authService = {
  // Token Management
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  // User Profile Management
  getUser: () => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  removeUser: () => {
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  // Authentication API calls
  login: async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email: email.trim(),
        password: password,
      });

      const { access_token, user } = response.data;
      if (access_token) {
        authService.setToken(access_token);
        authService.setUser(user);
      }
      return response.data;
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Unable to connect to authentication service. Please check backend connection.';
      throw new Error(errorMsg);
    }
  },

  signup: async (userData) => {
    try {
      const response = await axios.post('/api/auth/signup', {
        full_name: userData.fullName.trim(),
        email: userData.email.trim(),
        password: userData.password,
        confirm_password: userData.confirmPassword,
        role: userData.role || 'Lead Project Engineer',
      });
      return response.data;
    } catch (err) {
      let errorMsg = 'Failed to create account.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map((d) => d.msg || d).join(', ');
        }
      }
      throw new Error(errorMsg);
    }
  },

  getMe: async () => {
    const token = authService.getToken();
    if (!token) {
      throw new Error('No authentication token found.');
    }
    const response = await axios.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.data) {
      authService.setUser(response.data);
    }
    return response.data;
  },

  logout: () => {
    authService.removeToken();
    authService.removeUser();
  },
};

export default authService;
