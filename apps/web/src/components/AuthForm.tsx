import React, { useState } from 'react';
import { trpc } from '../trpc/client';

export default function AuthForm() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [namaLembaga, setNamaLembaga] = useState('');
  const [noRegBwi, setNoRegBwi] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const response = await trpc.auth.login.mutate({ email, password });
      if (response.success) {
        setSuccessMsg('Login berhasil! Mengalihkan...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Email atau password salah.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const response = await trpc.auth.registerNazhir.mutate({
        email,
        password,
        namaLembaga,
        noRegBwi,
        alamat,
        telepon: telepon || undefined,
      });

      if (response.success) {
        setSuccessMsg('Registrasi berhasil! Mengalihkan ke Dashboard...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Pendaftaran gagal. Pastikan data unik.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-2xl p-8 transition-all duration-300 hover:border-emerald-500/20">
      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8 p-1 bg-slate-950/40 rounded-lg">
        <button
          onClick={() => { setTab('login'); resetMessages(); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
            tab === 'login'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          type="button"
        >
          Masuk (Login)
        </button>
        <button
          onClick={() => { setTab('register'); resetMessages(); }}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
            tab === 'register'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          type="button"
        >
          Daftar Nazhir Baru
        </button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2 animate-fade-in">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2 animate-fade-in">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Forms */}
      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" htmlFor="login-email">
              Email Pengguna
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-200"
              placeholder="nama@lembaga.org"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-200"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200 flex justify-center items-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <span>Masuk Ke Dashboard</span>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="reg-email">
              Email Akun
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-150"
              placeholder="admin@lembaga.org"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="reg-password">
              Password (Min. 8 Karakter)
            </label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-150"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="reg-lembaga">
              Nama Lembaga Nazhir
            </label>
            <input
              id="reg-lembaga"
              type="text"
              value={namaLembaga}
              onChange={(e) => setNamaLembaga(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-150"
              placeholder="Yayasan Wakaf Amanah"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="reg-bwi">
              Nomor Registrasi BWI
            </label>
            <input
              id="reg-bwi"
              type="text"
              value={noRegBwi}
              onChange={(e) => setNoRegBwi(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-150"
              placeholder="3.x.xxxxxx"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="reg-alamat">
              Alamat Kantor Lembaga
            </label>
            <textarea
              id="reg-alamat"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-150 h-20 resize-none"
              placeholder="Jl. Raya Wakaf No. 10, Jakarta"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="reg-telepon">
              Nomor Telepon Lembaga (Opsional)
            </label>
            <input
              id="reg-telepon"
              type="tel"
              value={telepon}
              onChange={(e) => setTelepon(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition duration-150"
              placeholder="021xxxxxx atau 08xxxxxx"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98] transition-all duration-200 flex justify-center items-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <span>Daftar Sekarang</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
