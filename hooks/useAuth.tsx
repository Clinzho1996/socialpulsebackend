import React, { useEffect, useState, createContext, useContext } from 'react';
import { auth, onAuthChange, User } from '../lib/firebase';
interface AuthContextType {
  user: User | null;
  loading: boolean;
}
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true
});
export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Subscribe to auth changes
    const unsubscribe = onAuthChange(newUser => {
      setUser(newUser);
      setLoading(false);
    });
    // Cleanup subscription
    return () => unsubscribe();
  }, []);
  return <AuthContext.Provider value={{
    user,
    loading
  }}>
      {children}
    </AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);