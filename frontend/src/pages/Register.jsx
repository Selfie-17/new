import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, UserPlus, AlertCircle } from 'lucide-react';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await register(name, email, password, role);

        if (result.success) {
            navigate(`/${role}`);
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    const roles = [
        { value: 'viewer', label: 'Viewer', description: 'Read-only access to files' },
        { value: 'editor', label: 'Editor', description: 'Create & edit files with approval' },
        { value: 'admin', label: 'Admin', description: 'Full access & approval rights' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-8">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4">
                        <FileText className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">MD Collab Platform</h1>
                    <p className="text-gray-400 mt-2">Join the collaboration</p>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
                    <h2 className="text-2xl font-semibold text-white mb-6">Create Account</h2>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <span className="text-red-200 text-sm">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="John Doe"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">Role</label>
                            <div className="space-y-2">
                                {roles.map((r) => (
                                    <label
                                        key={r.value}
                                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${role === r.value
                                                ? 'border-purple-500 bg-purple-500/20'
                                                : 'border-white/20 bg-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={r.value}
                                            checked={role === r.value}
                                            onChange={(e) => setRole(e.target.value)}
                                            className="hidden"
                                        />
                                        <div>
                                            <span className="text-white font-medium">{r.label}</span>
                                            <p className="text-gray-400 text-sm">{r.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    Create Account
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-gray-400 mt-6">
                        Already have an account?{' '}
                        <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
