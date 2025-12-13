import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Check,
    CheckCheck,
    X,
    FileText,
    CheckCircle,
    XCircle,
    Send,
    Eye,
    Trash2,
    Clock
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
    const {
        notifications,
        unreadCount,
        loading,
        isOpen,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        toggleDropdown,
        closeDropdown
    } = useNotifications();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                closeDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeDropdown]);

    // Get icon based on notification type
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'version_submitted':
                return <Send className="w-4 h-4 text-blue-500" />;
            case 'version_approved':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'version_rejected':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'file_published':
            case 'file_updated':
                return <FileText className="w-4 h-4 text-purple-500" />;
            case 'comment_added':
                return <Eye className="w-4 h-4 text-orange-500" />;
            default:
                return <Bell className="w-4 h-4 text-gray-500" />;
        }
    };

    // Get background color based on notification type
    const getNotificationBg = (type, isRead) => {
        if (isRead) return 'bg-white';
        switch (type) {
            case 'version_submitted':
                return 'bg-blue-50';
            case 'version_approved':
                return 'bg-green-50';
            case 'version_rejected':
                return 'bg-red-50';
            case 'file_published':
            case 'file_updated':
                return 'bg-purple-50';
            default:
                return 'bg-gray-50';
        }
    };

    // Format time ago
    const formatTimeAgo = (date) => {
        const now = new Date();
        const notifDate = new Date(date);
        const diffMs = now - notifDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return notifDate.toLocaleDateString();
    };

    // Handle notification click
    const handleNotificationClick = (notification) => {
        if (!notification.isRead) {
            markAsRead(notification._id);
        }

        // Navigate based on type
        closeDropdown();

        // You can customize navigation based on notification type and user role
        // For now, just close the dropdown
    };

    const displayedNotifications = notifications.slice(0, 5);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={toggleDropdown}
                className="relative p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-purple-600" />
                            <h3 className="font-semibold text-gray-900">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                            >
                                <CheckCheck className="w-3 h-3" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            </div>
                        ) : displayedNotifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-500 font-medium">No notifications</p>
                                <p className="text-sm text-gray-400">You're all caught up!</p>
                            </div>
                        ) : (
                            displayedNotifications.map((notification) => (
                                <div
                                    key={notification._id}
                                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition ${getNotificationBg(notification.type, notification.isRead)}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm ${notification.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                                    {notification.title}
                                                </p>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {!notification.isRead && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                markAsRead(notification._id);
                                                            }}
                                                            className="p-1 hover:bg-gray-200 rounded transition"
                                                            title="Mark as read"
                                                        >
                                                            <Check className="w-3 h-3 text-gray-400" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(notification._id);
                                                        }}
                                                        className="p-1 hover:bg-red-100 rounded transition"
                                                        title="Delete"
                                                    >
                                                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatTimeAgo(notification.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 5 && (
                        <div className="p-3 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => {
                                    closeDropdown();
                                    // Navigate to notifications page if you have one
                                }}
                                className="w-full text-center text-sm text-purple-600 hover:text-purple-800 font-medium"
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
