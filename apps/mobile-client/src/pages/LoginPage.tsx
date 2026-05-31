import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-void-900 items-center justify-center px-6 safe-top">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-classified/10 border border-classified/20 flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-classified" />
          </div>
          <h1 className="font-display text-3xl tracking-widest text-classified">MARKETER PRO</h1>
          <p className="text-xs text-slate-500 tracking-[0.25em] uppercase mt-1">Office Edition</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full h-12 px-4 rounded-xl bg-desk-800 border border-white/[0.08] text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-classified/40 focus:bg-desk-700 transition-all"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full h-12 px-4 rounded-xl bg-desk-800 border border-white/[0.08] text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-classified/40 focus:bg-desk-700 transition-all"
          />

          {error && (
            <p className="text-xs text-red-400 px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-classified text-void-900 font-heading font-semibold tracking-wider text-sm hover:bg-classified-light active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #c9a84c 0%, #9d7c2e 100%)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ACCESS DESK'}
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 mt-6">
          <button className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Create account
          </button>
          <div className="w-px h-3 bg-slate-800" />
          <button className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Forgot password
          </button>
        </div>
      </motion.div>
    </div>
  );
};
