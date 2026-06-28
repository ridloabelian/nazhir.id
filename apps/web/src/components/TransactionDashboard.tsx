import React, { useState, useEffect } from 'react';
import { trpc } from '../trpc/client';

type Tab = 'aset' | 'keuangan' | 'dampak' | 'nazhir';

export default function TransactionDashboard({ role }: { role: string }) {
  const [activeTab, setActiveTab] = useState<Tab>(role === 'NAZHIR' ? 'aset' : 'nazhir');
  const [showModal, setShowModal] = useState<string | null>(null); // 'aset' | 'keuangan' | 'dampak' | null
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  // Form states
  const [tipeAset, setTipeAset] = useState<'TANAH' | 'BANGUNAN' | 'UANG' | 'SURAT_BERHARGA'>('TANAH');
  const [namaAset, setNamaAset] = useState('');
  const [nilaiEstimasi, setNilaiEstimasi] = useState('');
  const [luasTanah, setLuasTanah] = useState('');
  const [luasBangunan, setLuasBangunan] = useState('');
  const [alamatAset, setAlamatAset] = useState('');
  const [fileSertifikat, setFileSertifikat] = useState<File | null>(null);

  const [periodeBulan, setPeriodeBulan] = useState(new Date().getMonth() + 1);
  const [periodeTahun, setPeriodeTahun] = useState(2026);
  const [totalPenerimaan, setTotalPenerimaan] = useState('');
  const [totalPenyaluran, setTotalPenyaluran] = useState('');
  const [filePdf, setFilePdf] = useState<File | null>(null);

  const [namaProgram, setNamaProgram] = useState('');
  const [jumlahPenerima, setJumlahPenerima] = useState('');
  const [sektorDampak, setSektorDampak] = useState<'PENDIDIKAN' | 'KESEHATAN' | 'EKONOMI' | 'SOSIAL'>('PENDIDIKAN');
  const [deskripsiDampak, setDeskripsiDampak] = useState('');

  // UI States
  const [uploadProgress, setUploadProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'aset') {
        const res = await trpc.aset.getAsetList.query();
        setData(res);
      } else if (activeTab === 'keuangan') {
        const res = await trpc.keuangan.getLaporanList.query();
        setData(res);
      } else if (activeTab === 'dampak') {
        const res = await trpc.dampak.getDampakList.query();
        setData(res);
      } else if (activeTab === 'nazhir') {
        const res = await trpc.nazhir.listNazhir.query();
        setData(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Form Upload Helper
  const uploadFile = async (file: File): Promise<string> => {
    setUploadProgress(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    setUploadProgress(false);

    if (!res.ok) {
      throw new Error(result.error || 'Gagal mengunggah berkas.');
    }
    return result.url;
  };

  // Submissions
  const handleAddAset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      let urlSertifikat = null;
      if (fileSertifikat) {
        urlSertifikat = await uploadFile(fileSertifikat);
      }

      await trpc.aset.createAset.mutate({
        tipeAset,
        namaAset,
        nilaiEstimasi: parseFloat(nilaiEstimasi),
        luasTanah: luasTanah ? parseFloat(luasTanah) : null,
        luasBangunan: luasBangunan ? parseFloat(luasBangunan) : null,
        alamatAset: alamatAset || null,
        urlSertifikat,
      });

      setShowModal(null);
      // Reset form
      setNamaAset('');
      setNilaiEstimasi('');
      setLuasTanah('');
      setLuasBangunan('');
      setAlamatAset('');
      setFileSertifikat(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan aset.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (!filePdf) {
        throw new Error('Berkas PDF wajib diunggah.');
      }
      const urlDokumenPdf = await uploadFile(filePdf);

      await trpc.keuangan.submitLaporan.mutate({
        periodeBulan: parseInt(periodeBulan.toString()),
        periodeTahun: parseInt(periodeTahun.toString()),
        totalPenerimaan: parseFloat(totalPenerimaan),
        totalPenyaluran: parseFloat(totalPenyaluran),
        urlDokumenPdf,
      });

      setShowModal(null);
      setTotalPenerimaan('');
      setTotalPenyaluran('');
      setFilePdf(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim laporan.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendDampak = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await trpc.dampak.submitDampak.mutate({
        namaProgram,
        jumlahPenerima: parseInt(jumlahPenerima),
        sektorDampak,
        deskripsiDampak,
      });

      setShowModal(null);
      setNamaProgram('');
      setJumlahPenerima('');
      setDeskripsiDampak('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim laporan dampak.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAset = async (id: string) => {
    if (!confirm('Ajukan aset ini ke Admin ANI? Data akan masuk antrean verifikasi.')) return;
    setLoading(true);
    try {
      await trpc.aset.submitAset.mutate({ id });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengajukan aset.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'aset' | 'keuangan', status: 'APPROVED' | 'REJECTED') => {
    const reason = status === 'REJECTED' ? prompt('Masukkan catatan revisi / alasan penolakan:') : '';
    if (status === 'REJECTED' && reason === null) return; // cancel

    setLoading(true);
    try {
      if (type === 'aset') {
        await trpc.aset.approveAset.mutate({ id, status, catatanRevisi: reason || undefined });
      } else {
        await trpc.keuangan.approveLaporan.mutate({ id, status, catatanRevisi: reason || undefined });
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNazhir = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    if (!confirm(`Apakah Anda yakin ingin menandai lembaga ini sebagai ${status}?`)) return;
    setLoading(true);
    try {
      await trpc.nazhir.verifyNazhir.mutate({ id, status });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal memverifikasi lembaga.');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      DRAFT: 'bg-slate-800 text-slate-400 border-slate-700/50',
      SUBMITTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-bold border rounded-md uppercase tracking-wider ${colors[status as keyof typeof colors] || 'bg-slate-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-900 pb-px gap-6">
        {(role === 'ADMIN_ANI' || role === 'VERIFIKATOR') && (
          <button
            onClick={() => setActiveTab('nazhir')}
            className={`pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
              activeTab === 'nazhir' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Daftar Nazhir
          </button>
        )}
        <button
          onClick={() => setActiveTab('aset')}
          className={`pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === 'aset' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Aset Wakaf
        </button>
        <button
          onClick={() => setActiveTab('keuangan')}
          className={`pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === 'keuangan' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Laporan Keuangan
        </button>
        <button
          onClick={() => setActiveTab('dampak')}
          className={`pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === 'dampak' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Dampak Sosial
        </button>
      </div>

      {/* Action Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">
          Daftar {activeTab === 'aset' ? 'Aset Wakaf' : activeTab === 'keuangan' ? 'Laporan Keuangan' : activeTab === 'dampak' ? 'Laporan Dampak' : 'Nazhir Terdaftar'}
        </h3>
        {role === 'NAZHIR' && activeTab !== 'nazhir' && (
          <button
            onClick={() => setShowModal(activeTab)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow transition duration-200 cursor-pointer"
          >
            {activeTab === 'aset' ? '+ Tambah Aset' : activeTab === 'keuangan' ? '+ Kirim Laporan' : '+ Laporkan Dampak'}
          </button>
        )}
      </div>

      {/* Error display */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-2">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* Main Table / List */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm italic">
            Belum ada data yang dapat ditampilkan untuk modul ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-900/30 text-slate-400 font-medium">
                  {activeTab === 'aset' && (
                    <>
                      {role !== 'NAZHIR' && <th className="p-4">Nazhir</th>}
                      <th className="p-4">Tipe Aset</th>
                      <th className="p-4">Nama Aset</th>
                      <th className="p-4">Nilai Estimasi</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Sertifikat</th>
                      {role === 'ADMIN_ANI' && <th className="p-4 text-right">Aksi</th>}
                    </>
                  )}
                  {activeTab === 'keuangan' && (
                    <>
                      {role !== 'NAZHIR' && <th className="p-4">Nazhir</th>}
                      <th className="p-4">Periode</th>
                      <th className="p-4">Penerimaan</th>
                      <th className="p-4">Penyaluran</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Unduh PDF</th>
                      {role === 'ADMIN_ANI' && <th className="p-4 text-right">Aksi</th>}
                    </>
                  )}
                  {activeTab === 'dampak' && (
                    <>
                      {role !== 'NAZHIR' && <th className="p-4">Nazhir</th>}
                      <th className="p-4">Nama Program</th>
                      <th className="p-4">Penerima Manfaat</th>
                      <th className="p-4">Sektor</th>
                      <th className="p-4">Deskripsi Dampak</th>
                    </>
                  )}
                  {activeTab === 'nazhir' && (
                    <>
                      <th className="p-4">Nama Lembaga</th>
                      <th className="p-4">No. Reg BWI</th>
                      <th className="p-4">Alamat & Telepon</th>
                      <th className="p-4">Status</th>
                      {(role === 'ADMIN_ANI' || role === 'VERIFIKATOR') && <th className="p-4 text-right">Aksi</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {data.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-900/10 transition-colors">
                    {/* Nazhir Columns */}
                    {activeTab === 'nazhir' && (
                      <>
                        <td className="p-4 text-slate-100 font-bold">{item.nama_lembaga}</td>
                        <td className="p-4 text-slate-300 font-mono text-xs">{item.no_reg_bwi}</td>
                        <td className="p-4 text-slate-400 text-xs">
                          <div>{item.alamat}</div>
                          {item.telepon && <div className="text-slate-500 mt-0.5">📞 {item.telepon}</div>}
                        </td>
                        <td className="p-4">{getStatusBadge(item.status_verifikasi)}</td>
                        {(role === 'ADMIN_ANI' || role === 'VERIFIKATOR') && (
                          <td className="p-4 text-right space-x-2">
                            {item.status_verifikasi === 'PENDING' ? (
                              <>
                                <button
                                  onClick={() => handleVerifyNazhir(item.id, 'VERIFIED')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                                >
                                  Setujui
                                </button>
                                <button
                                  onClick={() => handleVerifyNazhir(item.id, 'REJECTED')}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold cursor-pointer"
                                >
                                  Tolak
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Telah diverifikasi</span>
                            )}
                          </td>
                        )}
                      </>
                    )}

                    {/* Aset Columns */}
                    {activeTab === 'aset' && (
                      <>
                        {role !== 'NAZHIR' && <td className="p-4 text-slate-300 font-semibold">{item.nama_lembaga}</td>}
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
                            {item.tipe_aset}
                          </span>
                        </td>
                        <td className="p-4 text-slate-100 font-medium">{item.nama_aset}</td>
                        <td className="p-4 text-slate-200 font-semibold">{formatRupiah(item.nilai_estimasi)}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            {getStatusBadge(item.status_approval)}
                            {item.catatan_revisi && (
                              <span className="text-xs text-rose-400 max-w-xs italic leading-tight mt-1">Revisi: {item.catatan_revisi}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-2 items-start">
                            {item.url_sertifikat ? (
                              <a
                                href={item.url_sertifikat}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 text-xs"
                              >
                                📂 Lihat Sertifikat
                              </a>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Tidak ada</span>
                            )}
                            {role === 'NAZHIR' && (item.status_approval === 'DRAFT' || item.status_approval === 'REJECTED') && (
                              <button
                                onClick={() => handleSubmitAset(item.id)}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer"
                              >
                                Ajukan
                              </button>
                            )}
                          </div>
                        </td>
                        {role === 'ADMIN_ANI' && (
                          <td className="p-4 text-right space-x-2">
                            {item.status_approval === 'SUBMITTED' || item.status_approval === 'DRAFT' ? (
                              <>
                                <button
                                  onClick={() => handleApprove(item.id, 'aset', 'APPROVED')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprove(item.id, 'aset', 'REJECTED')}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Selesai diperiksa</span>
                            )}
                          </td>
                        )}
                      </>
                    )}

                    {/* Keuangan Columns */}
                    {activeTab === 'keuangan' && (
                      <>
                        {role !== 'NAZHIR' && <td className="p-4 text-slate-300 font-semibold">{item.nama_lembaga}</td>}
                        <td className="p-4 text-slate-200 font-semibold">Bulan {item.periode_bulan} / {item.periode_tahun}</td>
                        <td className="p-4 text-emerald-400 font-semibold">{formatRupiah(item.total_penerimaan)}</td>
                        <td className="p-4 text-amber-400 font-semibold">{formatRupiah(item.total_penyaluran)}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            {getStatusBadge(item.status_approval)}
                            {item.catatan_revisi && (
                              <span className="text-xs text-rose-400 max-w-xs italic leading-tight mt-1">Revisi: {item.catatan_revisi}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <a
                            href={item.url_dokumen_pdf}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 text-xs"
                          >
                            📄 Dokumen Laporan
                          </a>
                        </td>
                        {role === 'ADMIN_ANI' && (
                          <td className="p-4 text-right space-x-2">
                            {item.status_approval === 'SUBMITTED' ? (
                              <>
                                <button
                                  onClick={() => handleApprove(item.id, 'keuangan', 'APPROVED')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprove(item.id, 'keuangan', 'REJECTED')}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Selesai diperiksa</span>
                            )}
                          </td>
                        )}
                      </>
                    )}

                    {/* Dampak Columns */}
                    {activeTab === 'dampak' && (
                      <>
                        {role !== 'NAZHIR' && <td className="p-4 text-slate-300 font-semibold">{item.nama_lembaga}</td>}
                        <td className="p-4 text-slate-100 font-bold">{item.nama_program}</td>
                        <td className="p-4 text-slate-200 font-medium">{item.jumlah_penerima.toLocaleString('id-ID')} jiwa</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
                            {item.sektor_dampak}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs leading-relaxed max-w-xs">{item.deskripsi_dampak}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tambah Aset */}
      {showModal === 'aset' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <h4 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Registrasi Aset Wakaf Baru</h4>
            <form onSubmit={handleAddAset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipe Aset</label>
                <select
                  value={tipeAset}
                  onChange={(e: any) => setTipeAset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="TANAH">TANAH</option>
                  <option value="BANGUNAN">BANGUNAN</option>
                  <option value="UANG">UANG</option>
                  <option value="SURAT_BERHARGA">SURAT BERHARGA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nama Aset</label>
                <input
                  type="text"
                  value={namaAset}
                  onChange={(e) => setNamaAset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-emerald-500"
                  placeholder="Contoh: Tanah Wakaf Masjid Jami"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nilai Estimasi Aset (IDR)</label>
                <input
                  type="number"
                  value={nilaiEstimasi}
                  onChange={(e) => setNilaiEstimasi(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-emerald-500"
                  placeholder="Masukkan nominal angka saja"
                  required
                />
              </div>

              {(tipeAset === 'TANAH' || tipeAset === 'BANGUNAN') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Luas Tanah (m²)</label>
                    <input
                      type="number"
                      value={luasTanah}
                      onChange={(e) => setLuasTanah(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Luas Bangunan (m²)</label>
                    <input
                      type="number"
                      value={luasBangunan}
                      onChange={(e) => setLuasBangunan(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-700 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Alamat Fisik Aset</label>
                <textarea
                  value={alamatAset}
                  onChange={(e) => setAlamatAset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-700 h-20 resize-none"
                  placeholder="Tuliskan lokasi rinci aset wakaf..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Upload File Sertifikat (PDF/Gambar)</label>
                <input
                  type="file"
                  onChange={(e) => setFileSertifikat(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-slate-400 text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                  accept="application/pdf,image/*"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="submit"
                  disabled={loading || uploadProgress}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-sm shadow transition cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Aset'}
                </button>
                <button
                  onClick={() => setShowModal(null)}
                  type="button"
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-sm transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Kirim Laporan Keuangan */}
      {showModal === 'keuangan' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h4 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Kirim Laporan Keuangan Berkala</h4>
            <form onSubmit={handleSendLaporan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Periode Bulan</label>
                  <select
                    value={periodeBulan}
                    onChange={(e) => setPeriodeBulan(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Bulan {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tahun</label>
                  <input
                    type="number"
                    value={periodeTahun}
                    onChange={(e) => setPeriodeTahun(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Penerimaan Bulan Ini (IDR)</label>
                <input
                  type="number"
                  value={totalPenerimaan}
                  onChange={(e) => setTotalPenerimaan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                  placeholder="Kas Masuk"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Penyaluran Bulan Ini (IDR)</label>
                <input
                  type="number"
                  value={totalPenyaluran}
                  onChange={(e) => setTotalPenyaluran(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                  placeholder="Kas Penyaluran / Pendayagunaan"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Upload Laporan Keuangan (Wajib PDF)</label>
                <input
                  type="file"
                  onChange={(e) => setFilePdf(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-slate-400 text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300"
                  accept="application/pdf"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="submit"
                  disabled={loading || uploadProgress}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-sm shadow transition cursor-pointer"
                >
                  {loading ? 'Mengirim...' : 'Kirim Laporan'}
                </button>
                <button
                  onClick={() => setShowModal(null)}
                  type="button"
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-sm transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Laporkan Dampak */}
      {showModal === 'dampak' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h4 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Laporkan Dampak Sosial Program</h4>
            <form onSubmit={handleSendDampak} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nama Program / Kegiatan</label>
                <input
                  type="text"
                  value={namaProgram}
                  onChange={(e) => setNamaProgram(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                  placeholder="Contoh: Beasiswa Pendidikan Santri Wakaf"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Jumlah Penerima Manfaat</label>
                  <input
                    type="number"
                    value={jumlahPenerima}
                    onChange={(e) => setJumlahPenerima(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="Berapa Jiwa/Orang"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sektor Dampak</label>
                  <select
                    value={sektorDampak}
                    onChange={(e: any) => setSektorDampak(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200"
                  >
                    <option value="PENDIDIKAN">PENDIDIKAN</option>
                    <option value="KESEHATAN">KESEHATAN</option>
                    <option value="EKONOMI">EKONOMI</option>
                    <option value="SOSIAL">SOSIAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Deskripsi Dampak Sosial</label>
                <textarea
                  value={deskripsiDampak}
                  onChange={(e) => setDeskripsiDampak(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 h-24 resize-none text-xs leading-relaxed"
                  placeholder="Tuliskan dampak nyata program secara naratif (misal: penyaluran alat medis, peningkatan taraf ekonomi masyarakat)..."
                  required
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-sm shadow transition cursor-pointer"
                >
                  {loading ? 'Mengirim...' : 'Kirim Dampak'}
                </button>
                <button
                  onClick={() => setShowModal(null)}
                  type="button"
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-sm transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
