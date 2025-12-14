import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from '../config/axiosConfig';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Initialize socket connection when user is authenticated
    useEffect(() => {
        if (user) {
            const token = localStorage.getItem('token');
            // Get baseURL - use environment variable or default to localhost:5000
            // Socket.IO needs the full backend URL, not the proxy
            let baseURL = import.meta.env.VITE_API_BASE_URL;
            
            // If no env variable, determine the correct backend URL
            if (!baseURL || baseURL.trim() === '') {
                // Check if we're in development (Vite dev server on port 3000)
                if (import.meta.env.DEV) {
                    // In dev, backend is on port 5000
                    baseURL = 'http://localhost:5000';
                } else {
                    // In production, use same origin (backend should be on same domain)
                    baseURL = window.location.origin;
                }
            }
            
            // Remove trailing slash if present
            baseURL = baseURL.replace(/\/$/, '');
            
            // Ensure baseURL is not empty and is a valid URL
            if (!baseURL || (!baseURL.startsWith('http://') && !baseURL.startsWith('https://'))) {
                console.error('Socket.IO: Invalid API base URL:', baseURL);
                return;
            }
            
            console.log('Socket.IO: Connecting to', baseURL);
            
            if (token) {
                const newSocket = io(baseURL, {
                    auth: { token },
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    reconnectionAttempts: 5,
                    timeout: 20000, // 20 seconds timeout
                    forceNew: false,
                    autoConnect: true,
                    upgrade: true,
                    rememberUpgrade: true,
                    path: '/socket.io/' // Explicit path
                });

                newSocket.on('connect', () => {
                    console.log('🔌 Socket connected successfully');
                });

                newSocket.on('disconnect', (reason) => {
                    console.log('🔌 Socket disconnected:', reason);
                    if (reason === 'io server disconnect') {
                        // Server disconnected the socket, reconnect manually
                        newSocket.connect();
                    }
                });

                newSocket.on('connect_error', (error) => {
                    console.warn('🔌 Socket connection error:', error.message);
                    // Don't spam console with connection errors
                    // Only log if it's not a timeout/connection refused
                    if (!error.message.includes('timeout') && !error.message.includes('ECONNREFUSED')) {
                        console.error('Socket error details:', error);
                    }
                });

                newSocket.on('reconnect', (attemptNumber) => {
                    console.log(`🔌 Socket reconnected after ${attemptNumber} attempts`);
                });

                newSocket.on('reconnect_attempt', (attemptNumber) => {
                    console.log(`🔌 Socket reconnection attempt ${attemptNumber}`);
                });

                newSocket.on('reconnect_error', (error) => {
                    console.warn('🔌 Socket reconnection error:', error.message);
                });

                newSocket.on('reconnect_failed', () => {
                    console.error('🔌 Socket reconnection failed. Please refresh the page.');
                });

                // Listen for new notifications
                newSocket.on('notification:new', (notification) => {
                    console.log('📩 New notification:', notification);
                    setNotifications(prev => [notification, ...prev]);
                });

                // Listen for unread count updates
                newSocket.on('notification:unreadCount', ({ count }) => {
                    setUnreadCount(count);
                });

                setSocket(newSocket);

                // Cleanup on unmount or user change
                return () => {
                    if (newSocket.connected) {
                        newSocket.disconnect();
                    }
                    newSocket.close();
                };
            }
        } else {
            // User logged out, close socket
            if (socket) {
                if (socket.connected) {
                    socket.disconnect();
                }
                socket.close();
                setSocket(null);
            }
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user]);

    // Fetch notifications on mount and when user changes
    const fetchNotifications = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const [notifRes, countRes] = await Promise.all([
                axios.get('/api/notifications?limit=20'),
                axios.get('/api/notifications/unread')
            ]);
            setNotifications(notifRes.data.notifications || []);
            setUnreadCount(countRes.data.count || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            // Demo data fallback
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Mark single notification as read
    const markAsRead = async (notificationId) => {
        try {
            // Optimistic update
            setNotifications(prev =>
                prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));

            await axios.post(`/api/notifications/${notificationId}/read`);
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Revert on error
            fetchNotifications();
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);

            await axios.post('/api/notifications/mark-read', { all: true });
        } catch (error) {
            console.error('Error marking all as read:', error);
            fetchNotifications();
        }
    };

    // Delete a notification
    const deleteNotification = async (notificationId) => {
        try {
            const notif = notifications.find(n => n._id === notificationId);

            // Optimistic update
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
            if (notif && !notif.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }

            await axios.delete(`/api/notifications/${notificationId}`);
        } catch (error) {
            console.error('Error deleting notification:', error);
            fetchNotifications();
        }
    };

    // Clear all notifications
    const clearAll = async () => {
        try {
            setNotifications([]);
            setUnreadCount(0);
            await axios.delete('/api/notifications');
        } catch (error) {
            console.error('Error clearing notifications:', error);
            fetchNotifications();
        }
    };

    // Toggle dropdown
    const toggleDropdown = () => {
        setIsOpen(prev => !prev);
    };

    const closeDropdown = () => {
        setIsOpen(false);
    };

    const value = {
        notifications,
        unreadCount,
        loading,
        isOpen,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        toggleDropdown,
        closeDropdown
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}
