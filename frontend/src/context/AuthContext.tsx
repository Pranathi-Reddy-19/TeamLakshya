// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { login, register, getMe, setAuthToken } from '../services/api';
import type { User, LoginCredentials, RegisterPayload } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        setAuthToken(storedToken);

        try {
          const userData = await getMe();
          setUser(userData);
        } catch (error) {
          console.warn('Token invalid or expired. Logging out.', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    // FIXED: Only call setAuthToken which handles both localStorage and API instance
    setAuthToken(token);
  }, [token]);

  const loginHandler = async (credentials: LoginCredentials) => {
    const data = await login(credentials);
    const accessToken = data.access_token;

    setAuthToken(accessToken);
    setToken(accessToken);

    try {
      const userData = await getMe();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user after login', error);
      logout();
      throw new Error('Login succeeded but failed to load user profile');
    }
  };

  const registerHandler = async (payload: RegisterPayload): Promise<User> => {
    return await register(payload);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login: loginHandler,
        register: registerHandler,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};