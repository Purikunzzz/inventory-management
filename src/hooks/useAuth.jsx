import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("lab_token");
      const storedUser = localStorage.getItem("lab_currentUser");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem("lab_token");
      localStorage.removeItem("lab_currentUser");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const _storeAuth = useCallback((data) => {
    const { access_token, user } = data;
    localStorage.setItem("lab_token", access_token);
    localStorage.setItem("lab_currentUser", JSON.stringify(user));
    setToken(access_token);
    setCurrentUser(user);
  }, []);

  // Admins get a 2FA challenge instead of a session: return it (nothing stored)
  // so the login page can ask for the code, then call completeLogin().
  const _startSession = useCallback((data) => {
    if (data.mfa_required) return data;
    _storeAuth(data);
    return null;
  }, [_storeAuth]);

  const login = useCallback(async (credential) => {
    return _startSession(await authService.googleLogin(credential));
  }, [_startSession]);

  const emailLogin = useCallback(async (email, password) => {
    return _startSession(await authService.emailLogin(email, password));
  }, [_startSession]);

  const logout = useCallback(() => {
    localStorage.removeItem("lab_token");
    localStorage.removeItem("lab_currentUser");
    setToken(null);
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        login,
        emailLogin,
        completeLogin: _storeAuth,
        logout,
        isAuthenticated: !!currentUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
