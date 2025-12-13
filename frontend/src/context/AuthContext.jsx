import { createContext, useContext, useState, useEffect } from 'react';
import axios from '../config/axiosConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (storedUser && token) {
            setUser(JSON.parse(storedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await axios.post('/api/auth/login', { email, password });
            const { user, token } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.message || 'Login failed' };
        }
    };

    const register = async (name, email, password, role) => {
        try {
            const response = await axios.post('/api/auth/register', { name, email, password, role });
            const { user, token } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.message || 'Registration failed' };
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
