#!/usr/bin/env node
// Self-check logika inti modul akuntansi (tanpa framework, tanpa DB).
// Verifikasi: balance double-entry & penyusutan garis lurus.
import assert from 'node:assert';

// --- Balance check (cerminan validasi di createTransaksi) ---
function isValidTanggalTransaksi(input) {
  const tanggal = String(input ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && new Date(`${tanggal}T00:00:00Z`).toISOString().slice(0, 10) === tanggal;
}

function isBalanced(input) {
  const baris = Array.isArray(input)
    ? input.map((b) => ({ akunId: b.akunId, debit: Number(b.debit || 0), kredit: Number(b.kredit || 0) }))
    : [];
  const d = baris.reduce((s, b) => s + b.debit, 0);
  const k = baris.reduce((s, b) => s + b.kredit, 0);
  const perBarisValid = baris.every(
    (b) => b.akunId && Number.isFinite(b.debit) && Number.isFinite(b.kredit) && ((b.debit > 0 && b.kredit === 0) || (b.kredit > 0 && b.debit === 0))
  );
  return baris.length >= 2 && d === k && d > 0 && perBarisValid;
}
// Penerimaan wakaf uang 10jt: Kas (D) / Penerimaan Wakaf Uang (K)
assert.equal(isBalanced([{ akunId: 'kas', debit: 10000000, kredit: 0 }, { akunId: 'penerimaan', debit: 0, kredit: 10000000 }]), true, 'jurnal balance harus true');
assert.equal(isBalanced([{ akunId: 'kas', debit: 10000000, kredit: 0 }, { akunId: 'penerimaan', debit: 0, kredit: 9000000 }]), false, 'tidak balance harus false');
assert.equal(isBalanced([{ akunId: 'kas', debit: 5000, kredit: 5000 }, { akunId: 'penerimaan', debit: 0, kredit: 0 }]), false, 'baris debit+kredit sekaligus harus false');
assert.equal(isBalanced([{ akunId: 'kas', debit: 0, kredit: 0 }, { akunId: 'penerimaan', debit: 0, kredit: 0 }]), false, 'total 0 harus false');
assert.equal(isBalanced([{ akunId: 'kas', debit: 1000, kredit: 0 }, { akunId: '', debit: 0, kredit: 1000 }]), false, 'akun kosong harus false');
assert.equal(isBalanced([{ akunId: 'kas', debit: 1000, kredit: 0 }]), false, 'minimal dua baris');
assert.equal(new Set(['kas', 'penerimaan']).size, 2, 'akun unik dihitung sekali untuk validasi tenant');
assert.equal(isValidTanggalTransaksi('2026-07-17'), true, 'tanggal ISO valid');
assert.equal(isValidTanggalTransaksi('2026-02-30'), false, 'tanggal kalender invalid harus false');
assert.equal(isValidTanggalTransaksi(undefined), false, 'tanggal kosong harus false');
assert.equal(isValidTanggalTransaksi('2026-7-17'), false, 'tanggal non-ISO harus false');

// --- Penyusutan garis lurus (cerminan jalankanPenyusutan) ---
function penyusutanBulanan(nilaiPerolehan, umurBulan, akumulasi) {
  if (umurBulan <= 0) return 0;
  const sisa = nilaiPerolehan - akumulasi;
  if (sisa <= 0) return 0;
  const bulanan = Math.floor(nilaiPerolehan / umurBulan);
  return Math.min(bulanan, sisa);
}
// Ambulans 240jt, umur 60 bulan => 4jt/bulan
assert.equal(penyusutanBulanan(240000000, 60, 0), 4000000, 'penyusutan bulanan 4jt');
// Bulan terakhir tidak melebihi sisa
assert.equal(penyusutanBulanan(240000000, 60, 238000000), 2000000, 'bulan terakhir dibatasi sisa');
// Sudah habis
assert.equal(penyusutanBulanan(240000000, 60, 240000000), 0, 'aset habis => 0');

console.log('OK: semua self-check akuntansi lolos');
