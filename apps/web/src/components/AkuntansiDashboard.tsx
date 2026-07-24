import React, { useEffect, useMemo, useState } from 'react';
import { trpc } from '../trpc/client';

type Akun = { id: string; kode: string; nama: string; tipe: string; saldo_normal: string; is_kas: number };
type Row = { akunId: string; debit: string; kredit: string };

const rp = (v: number | string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v || 0));

export default function AkuntansiDashboard({ role }: { role: string }) {
  const [akun, setAkun] = useState<Akun[]>([]);
  const [neraca, setNeraca] = useState<any[]>([]);
  const [psak, setPsak] = useState<any>(null);
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [kategori, setKategori] = useState<'PENERIMAAN' | 'PENGELOLAAN' | 'PENYALURAN' | 'UMUM'>('PENERIMAAN');
  const [deskripsi, setDeskripsi] = useState('');
  const [rows, setRows] = useState<Row[]>([
    { akunId: '', debit: '', kredit: '' },
    { akunId: '', debit: '', kredit: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const kredit = rows.reduce((s, r) => s + Number(r.kredit || 0), 0);
    return { debit, kredit, balance: debit - kredit };
  }, [rows]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const [akunRes, neracaRes, psakRes, trxRes] = await Promise.all([
        trpc.akuntansi.listAkun.query(),
        trpc.akuntansi.neracaSaldo.query(),
        trpc.akuntansi.laporanPsak412.query(),
        trpc.akuntansi.listTransaksi.query(),
      ]);
      setAkun(akunRes as Akun[]);
      setNeraca(neracaRes as any[]);
      setPsak(psakRes);
      setTransaksi(trxRes as any[]);
    } catch (e: any) {
      setMsg(e.message || 'Gagal memuat modul akuntansi. Pastikan akun Nazhir sudah VERIFIED.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function seedCoa() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await trpc.akuntansi.seedCoaStandar.mutate();
      setMsg(`Bagan akun standar dibuat: ${res.count} akun.`);
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Gagal membuat bagan akun.');
    } finally {
      setLoading(false);
    }
  }

  async function submitTransaksi(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await trpc.akuntansi.createTransaksi.mutate({
        tanggal,
        kategori,
        deskripsi,
        baris: rows.map((r) => ({ akunId: r.akunId, debit: Number(r.debit || 0), kredit: Number(r.kredit || 0) })),
      });
      setMsg('Transaksi tersimpan sebagai DIAJUKAN. Menunggu persetujuan checker.');
      setDeskripsi('');
      setRows([{ akunId: '', debit: '', kredit: '' }, { akunId: '', debit: '', kredit: '' }]);
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Gagal menyimpan transaksi.');
    } finally {
      setLoading(false);
    }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <section className="border border-emerald-500/20 bg-emerald-950/5 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white">AkunWakaf — Akuntansi PSAK 412</h3>
          <p className="text-sm text-slate-400">Input jurnal double-entry, laporan otomatis, audit-ready.</p>
        </div>
        {role === 'NAZHIR' && akun.length === 0 && (
          <button onClick={seedCoa} disabled={loading} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
            Buat Bagan Akun Standar
          </button>
        )}
      </div>

      {msg && <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-300">{msg}</div>}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
          <div className="text-xs text-slate-500 font-bold uppercase">Total Aset</div>
          <div className="text-2xl font-black text-white">{rp(psak?.posisiKeuangan?.totalAset ?? 0)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
          <div className="text-xs text-slate-500 font-bold uppercase">Surplus / Defisit</div>
          <div className="text-2xl font-black text-emerald-400">{rp(psak?.aktivitas?.surplusDefisit ?? 0)}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
          <div className="text-xs text-slate-500 font-bold uppercase">Selisih Balance</div>
          <div className={`text-2xl font-black ${(psak?.posisiKeuangan?.balance ?? 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{rp(psak?.posisiKeuangan?.balance ?? 0)}</div>
        </div>
      </div>

      {role === 'NAZHIR' && akun.length > 0 && (
        <form onSubmit={submitTransaksi} className="space-y-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
          <div className="grid md:grid-cols-3 gap-3">
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" required />
            <select value={kategori} onChange={(e: any) => setKategori(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200">
              <option value="PENERIMAAN">Penerimaan</option><option value="PENGELOLAAN">Pengelolaan</option><option value="PENYALURAN">Penyaluran</option><option value="UMUM">Umum</option>
            </select>
            <input value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Deskripsi transaksi" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" required />
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid md:grid-cols-[1fr_160px_160px_44px] gap-2">
                <select value={r.akunId} onChange={(e) => setRow(i, { akunId: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" required>
                  <option value="">Pilih akun</option>
                  {akun.map((a) => <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>)}
                </select>
                <input type="number" min="0" step="1" value={r.debit} onChange={(e) => setRow(i, { debit: e.target.value, kredit: e.target.value ? '' : r.kredit })} placeholder="Debit" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" />
                <input type="number" min="0" step="1" value={r.kredit} onChange={(e) => setRow(i, { kredit: e.target.value, debit: e.target.value ? '' : r.debit })} placeholder="Kredit" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" />
                <button type="button" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="rounded-lg bg-slate-800 text-slate-300">×</button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-between text-sm">
            <button type="button" onClick={() => setRows([...rows, { akunId: '', debit: '', kredit: '' }])} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200">+ Baris</button>
            <div className={totals.balance === 0 && totals.debit > 0 ? 'text-emerald-400' : 'text-rose-400'}>Debit {rp(totals.debit)} / Kredit {rp(totals.kredit)} / Selisih {rp(totals.balance)}</div>
            <button disabled={loading || totals.balance !== 0 || totals.debit <= 0} className="px-4 py-2 rounded-xl bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold">Simpan Jurnal</button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-3 bg-slate-900/60 text-sm font-bold text-white">Neraca Saldo</div>
          <table className="w-full text-sm"><tbody>{neraca.map((r, i) => <tr key={i} className="border-t border-slate-900"><td className="p-3 text-slate-300">{r.kode} {r.nama}</td><td className="p-3 text-right text-emerald-400">{rp(r.total_debit)}</td><td className="p-3 text-right text-amber-400">{rp(r.total_kredit)}</td></tr>)}</tbody></table>
        </div>
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-3 bg-slate-900/60 text-sm font-bold text-white">Transaksi Terakhir</div>
          <table className="w-full text-sm"><tbody>{transaksi.slice(0, 8).map((t) => <tr key={t.id} className="border-t border-slate-900"><td className="p-3 text-slate-400">{t.tanggal}</td><td className="p-3 text-slate-200">{t.deskripsi}</td><td className="p-3 text-right text-slate-300">{rp(t.total)}</td><td className="p-3 text-right text-xs text-amber-400">{t.status}</td></tr>)}</tbody></table>
        </div>
      </div>
    </section>
  );
}
