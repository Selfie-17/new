import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ViewerDashboard from './pages/ViewerDashboard';
import EditorDashboard from './pages/EditorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Layout from './components/Layout';

function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to={`/${user.role}`} />;
    }

    return children;
}

function AppRoutes() {
    const { user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to={`/${user.role}`} /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to={`/${user.role}`} /> : <Register />} />

            <Route path="/viewer" element={
                <ProtectedRoute allowedRoles={['viewer', 'editor', 'admin']}>
                    <Layout><ViewerDashboard /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/editor" element={
                <ProtectedRoute allowedRoles={['editor', 'admin']}>
                    <Layout><EditorDashboard /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                    <Layout><AdminDashboard /></Layout>
                </ProtectedRoute>
            } />

            <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <NotificationProvider>
                    <AppRoutes />
                </NotificationProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
