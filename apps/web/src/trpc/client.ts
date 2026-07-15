// Client SDK: standard type-safe wrapper over hono/client or direct fetches.
// ponytail: we temporary mock the structure of trpc here using simple proxy or fetch wrapper
// to prevent breaking existing React code, avoiding refactoring 1000 lines of UI.

import { z } from 'zod';

class ClientError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ClientError';
  }
}

async function request(url: string, body?: any) {
  const method = body !== undefined ? 'POST' : 'GET';
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ClientError(data.error || 'Terjadi kesalahan sistem', data.code);
  }
  return data;
}

export const trpc = {
  auth: {
    login: {
      mutate: (input: any) => request('/api/auth/login', input)
    },
    logout: {
      mutate: () => request('/api/auth/logout', {})
    },
    registerNazhir: {
      mutate: (input: any) => request('/api/auth/register', input)
    },
    getMe: {
      query: () => request('/api/auth/me')
    }
  },
  nazhir: {
    getProfile: {
      query: () => request('/api/nazhir/profile')
    },
    updateProfile: {
      mutate: (input: any) => request('/api/nazhir/profile', input)
    },
    listNazhir: {
      query: () => request('/api/nazhir/list')
    },
    verifyNazhir: {
      mutate: (input: any) => request('/api/nazhir/verify', input)
    }
  },
  aset: {
    createAset: {
      mutate: (input: any) => request('/api/aset/create', input)
    },
    updateAset: {
      mutate: (input: any) => request('/api/aset/update', input)
    },
    submitAset: {
      mutate: (input: any) => request('/api/aset/submit', input)
    },
    getAsetList: {
      query: () => request('/api/aset/list')
    },
    approveAset: {
      mutate: (input: any) => request('/api/aset/approve', input)
    }
  },
  keuangan: {
    submitLaporan: {
      mutate: (input: any) => request('/api/keuangan/submit', input)
    },
    getLaporanList: {
      query: () => request('/api/keuangan/list')
    },
    approveLaporan: {
      mutate: (input: any) => request('/api/keuangan/approve', input)
    }
  },
  dampak: {
    submitDampak: {
      mutate: (input: any) => request('/api/dampak/submit', input)
    },
    getDampakList: {
      query: () => request('/api/dampak/list')
    }
  },
  akuntansi: {
    createAkun: {
      mutate: (input: any) => request('/api/akuntansi/akun/create', input)
    },
    listAkun: {
      query: () => request('/api/akuntansi/akun/list')
    },
    seedCoaStandar: {
      mutate: () => request('/api/akuntansi/akun/seed-coa', {})
    },
    createTransaksi: {
      mutate: (input: any) => request('/api/akuntansi/transaksi/create', input)
    },
    listTransaksi: {
      query: (input?: any) => {
        const query = input?.status ? `?status=${input.status}` : '';
        return request(`/api/akuntansi/transaksi/list${query}`);
      }
    },
    getTransaksiDetail: {
      query: (input: { id: string }) => request(`/api/akuntansi/transaksi/detail?id=${input.id}`)
    },
    reviewTransaksi: {
      mutate: (input: any) => request('/api/akuntansi/transaksi/review', input)
    },
    bukuBesar: {
      query: (input: { akunId: string }) => request(`/api/akuntansi/buku-besar?akunId=${input.akunId}`)
    },
    neracaSaldo: {
      query: () => request('/api/akuntansi/neraca-saldo')
    },
    laporanPsak412: {
      query: () => request('/api/akuntansi/laporan-psak412')
    },
    createAsetTetap: {
      mutate: (input: any) => request('/api/akuntansi/aset-tetap/create', input)
    },
    listAsetTetap: {
      query: () => request('/api/akuntansi/aset-tetap/list')
    },
    jalankanPenyusutan: {
      mutate: (input: any) => request('/api/akuntansi/aset-tetap/penyusutan', input)
    },
    tutupBuku: {
      mutate: (input: any) => request('/api/akuntansi/tutup-buku', input)
    },
    auditTrail: {
      query: () => request('/api/akuntansi/audit-trail')
    }
  }
};
