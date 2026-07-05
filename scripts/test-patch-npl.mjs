const productId = process.argv[2] || '894812b7-ed68-4025-a7a3-56b7d8f3a1ac';

const payloads = [
  {
    label: 'quantity numeric',
    body: {
      npl_phan_tram: [
        { ma_npl: 'NPL1', ten_npl: 'NVL 1', loai: 'so_luong', so_luong: 100, phan_tram: null, don_vi: 'Kg' }
      ]
    }
  },
  {
    label: 'percent numeric',
    body: {
      npl_phan_tram: [
        { ma_npl: 'NPL2', ten_npl: 'NVL 2', loai: 'phan_tram', phan_tram: 40.5, so_luong: null, don_vi: null }
      ]
    }
  },
  {
    label: 'percent comma string',
    body: {
      npl_phan_tram: [{ ma_npl: 'NPL3', ten_npl: 'NVL 3', phan_tram: '40,5' }]
    }
  }
];

for (const payload of payloads) {
  const res = await fetch(`http://localhost:3002/api/san-pham/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload.body)
  });
  const data = await res.json().catch(() => ({}));
  console.log(payload.label, res.status, data.error || 'OK');
}
