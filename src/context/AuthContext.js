'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ✅ Check localStorage on mount
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user");
            }
        }
        setLoading(false);
    }, []);

    // ✅ Call this function when login is successful
    const login = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // ✅ ADDED: Save network settings to localStorage for Axios
        if (userData.networkSettings && userData.networkSettings.ip) {
            const { ip, port } = userData.networkSettings;
            const url = `http://${ip}:${port}`;
            localStorage.setItem('custom_backend_url', url);
            localStorage.setItem('custom_backend_ip', ip);
            localStorage.setItem('custom_backend_port', port);
        }
        
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // ✅ ADDED: Clear network settings on logout
        localStorage.removeItem('custom_backend_url');
        localStorage.removeItem('custom_backend_ip');
        localStorage.removeItem('custom_backend_port');
        
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);