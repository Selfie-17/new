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
            const baseURL = import.meta.env.VITE_API_BASE_URL || '';
            if (token) {
                const newSocket = io(baseURL, {
                    auth: { token },
                    transports: ['websocket', 'polling']
                });

                newSocket.on('connect', () => {
                    console.log('🔌 Socket connected');
                });

                newSocket.on('disconnect', () => {
                    console.log('🔌 Socket disconnected');
                });

                newSocket.on('connect_error', (error) => {
                    console.log('🔌 Socket connection error:', error.message);
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
                    newSocket.close();
                };
            }
        } else {
            // User logged out, close socket
            if (socket) {
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
