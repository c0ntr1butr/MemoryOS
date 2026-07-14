import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatErr } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = anon, object = user
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("gov_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data.token) localStorage.setItem("gov_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Non-fatal: the server-side session may already be gone.
      console.warn("Logout request failed", err);
    }
    localStorage.removeItem("gov_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, login, register, logout, refresh, formatErr }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
