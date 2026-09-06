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

  const login = useCallback(async (credential) => {
    const data = await authService.googleLogin(credential);
    _storeAuth(data);
  }, [_storeAuth]);

  const emailLogin = useCallback(async (email, password) => {
    const data = await authService.emailLogin(email, password);
    _storeAuth(data);
  }, [_storeAuth]);

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
