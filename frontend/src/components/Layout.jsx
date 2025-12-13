import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FileText,
    LogOut,
    Eye,
    Edit,
    Shield,
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';
import NotificationBell from './NotificationBell';

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navigation = [
        { name: 'View Files', href: '/viewer', icon: Eye, roles: ['viewer', 'editor', 'admin'] },
        { name: 'Editor', href: '/editor', icon: Edit, roles: ['editor', 'admin'] },
        { name: 'Admin Panel', href: '/admin', icon: Shield, roles: ['admin'] },
    ];

    const filteredNav = navigation.filter(item => item.roles.includes(user?.role));

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navigation */}
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center">
                                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <span className="ml-2 text-xl font-bold text-gray-900">MD Collab</span>
                            </div>

                            {/* Desktop Navigation */}
                            <div className="hidden md:ml-8 md:flex md:space-x-4">
                                {filteredNav.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${isActive
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                                }`}
                                        >
                                            <Icon className="w-4 h-4 mr-2" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Notification Bell */}
                            <NotificationBell />

                            <div className="hidden md:flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${user?.role === 'admin' ? 'bg-red-500' :
                                    user?.role === 'editor' ? 'bg-blue-500' : 'bg-green-500'
                                    }`}>
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="hidden md:inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </button>

                            {/* Mobile menu button */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-gray-200 bg-white">
                        <div className="px-4 py-3 space-y-2">
                            {filteredNav.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${isActive
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>
        </div>
    );
}
