import React, { useEffect, useMemo, useRef, useState } from 'react';
import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';
import { Calculator, ChevronDown, ChevronUp, Loader2, MapPin, Save, UserPlus, X } from 'lucide-react';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { showAppToast, showSaveFailure } from '../../lib/appToast';

export type DeliveryRouteStop = {
  id: string;
  title: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  apiKm: number;
  manualKm: number | null;
  order?: number;
};

type RouteStop = DeliveryRouteStop & {
  kind: 'request' | 'adhoc';
  maKhachHang?: string;
};

type CustomerRecord = { code: string; name: string; address: string };

type PointValue = {
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type Suggestion = { refId: string; display: string; name: string; address: string };
type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: number[][];
  legs: Array<{ distanceMeters: number; durationSeconds: number }>;
};

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

/** Mỗi chặng một màu — lặp nếu nhiều đoạn hơn bảng màu. */
const LEG_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16'
] as const;

function legColor(index: number) {
  return LEG_COLORS[index % LEG_COLORS.length];
}

function nearestCoordinateIndex(coordinates: number[][], longitude: number, latitude: number) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  coordinates.forEach((coordinate, index) => {
    const dx = Number(coordinate[0]) - longitude;
    const dy = Number(coordinate[1]) - latitude;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** Cắt polyline tổng thành từng chặng theo các điểm dừng (lng/lat). */
function splitRouteIntoLegCoordinates(
  coordinates: number[][],
  waypoints: Array<{ longitude: number; latitude: number }>
) {
  if (coordinates.length < 2 || waypoints.length < 2) return [];
  const rawIndices = waypoints.map(point => nearestCoordinateIndex(coordinates, point.longitude, point.latitude));
  const indices: number[] = [];
  rawIndices.forEach((index, position) => {
    if (position === 0) {
      indices.push(index);
      return;
    }
    indices.push(Math.max(index, indices[position - 1] + 1));
  });
  indices[indices.length - 1] = Math.min(indices[indices.length - 1], coordinates.length - 1);

  const legs: number[][][] = [];
  for (let i = 0; i < indices.length - 1; i += 1) {
    const from = indices[i];
    const to = Math.max(indices[i + 1], from + 1);
    const slice = coordinates.slice(from, to + 1);
    if (slice.length >= 2) legs.push(slice);
  }
  return legs;
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}

function AddressPicker({ value, placeholder, onChange }: {
  value: PointValue;
  placeholder: string;
  onChange: (value: PointValue) => void;
}) {
  const [text, setText] = useState(value.address);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setText(value.address), [value.address]);

  useEffect(() => {
    if (!open || text.trim().length < 2 || text.trim() === value.address) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await readJson(await fetch(`/api/vietmap/autocomplete?text=${encodeURIComponent(text.trim())}`, { signal: controller.signal }));
        setSuggestions(Array.isArray(payload.rows) ? payload.rows : []);
      } catch (error: any) {
        if (error?.name !== 'AbortError') setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, text, value.address]);

  const select = async (suggestion: Suggestion) => {
    setLoading(true);
    try {
      const place = await readJson(await fetch(`/api/vietmap/place?refid=${encodeURIComponent(suggestion.refId)}`));
      const next = {
        address: place.display || suggestion.display,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude)
      };
      setText(next.address);
      setOpen(false);
      setSuggestions([]);
      onChange(next);
    } finally {
      setLoading(false);
    }
  };

  const resolveOnBlur = async () => {
    const trimmed = text.trim();
    if (!trimmed || value.latitude !== null) return;
    setLoading(true);
    try {
      let candidate = suggestions[0];
      if (!candidate) {
        const payload = await readJson(await fetch(`/api/vietmap/autocomplete?text=${encodeURIComponent(trimmed)}`));
        candidate = Array.isArray(payload.rows) ? payload.rows[0] : undefined;
      }
      if (candidate) await select(candidate);
    } catch {
      // Không tự tìm được toạ độ — người dùng gõ lại hoặc chọn tay 1 gợi ý.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${value.latitude === null ? 'text-rose-400' : 'text-emerald-500'}`} />
        <input
          value={text}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => void resolveOnBlur(), 150)}
          onChange={event => {
            setText(event.target.value);
            setOpen(true);
            onChange({ address: event.target.value, latitude: null, longitude: null });
          }}
          className={`${inputClass} pl-9 pr-9 ${value.latitude === null ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-500" />}
      </div>
      {value.latitude === null && !loading && (
        <p className="mt-1 text-[10px] font-bold text-rose-600">Chưa có toạ độ Vietmap — hệ thống sẽ tự chọn gợi ý gần nhất khi bạn rời khỏi ô này.</p>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {suggestions.map(suggestion => (
            <button
              key={suggestion.refId}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => void select(suggestion)}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-brand-50"
            >
              <span className="block font-bold text-slate-800">{suggestion.name || suggestion.display}</span>
              <span className="mt-0.5 block text-slate-500">{suggestion.display}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteMap({ tileKey, stops, start, end, route }: {
  tileKey: string;
  stops: DeliveryRouteStop[];
  start: PointValue;
  end: PointValue;
  route: RouteResult | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current || !tileKey || mapRef.current) return;
    let disposed = false;
    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${encodeURIComponent(tileKey)}`,
      center: [106.68, 16.05],
      zoom: 5
    });
    map.addControl(new vietmapgl.NavigationControl(), 'top-right');
    mapRef.current = map;
    const handleLoad = () => {
      if (!disposed) map.resize();
    };
    map.on('load', handleLoad);
    const resizeObserver = new ResizeObserver(() => {
      if (!disposed) map.resize();
    });
    resizeObserver.observe(containerRef.current);
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      mapRef.current = null;
      map.off('load', handleLoad);

      // Vietmap tách Style khỏi Map trước khi hủy request tải style. Nếu component
      // unmount khi style còn tải (đặc biệt trong React Strict Mode), AbortError
      // vì vậy không tới listener của Map và bị thư viện in như lỗi chưa xử lý.
      const style = map.style as
        | { on?: (type: string, listener: (event: { error?: unknown }) => void) => void }
        | undefined;
      style?.on?.('error', event => {
        const error = event?.error;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        if (error) console.error(error);
      });

      try {
        map.remove();
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
      }
    };
  }, [tileKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const render = () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      const deliveryStops = stops.filter(stop => stop.latitude !== null && stop.longitude !== null);
      const hasEnd = end.latitude !== null && end.longitude !== null;
      const points = [
        ...(start.latitude !== null && start.longitude !== null
          ? [{
              address: start.address || 'Điểm xuất phát',
              latitude: start.latitude,
              longitude: start.longitude,
              label: 'A',
              subLabel: 'Xuất phát',
              color: '#059669',
              size: 'lg' as const
            }]
          : []),
        ...deliveryStops.map((stop, index) => ({
          address: stop.address,
          latitude: stop.latitude as number,
          longitude: stop.longitude as number,
          label: String(index + 1),
          subLabel: stop.title || `Điểm ${index + 1}`,
          color: legColor(index),
          size: 'xl' as const
        })),
        ...(hasEnd
          ? [{
              address: end.address || 'Điểm kết thúc',
              latitude: end.latitude as number,
              longitude: end.longitude as number,
              label: 'B',
              subLabel: 'Kết thúc',
              color: '#2563eb',
              size: 'lg' as const
            }]
          : [])
      ];

      points.forEach(point => {
        const element = document.createElement('div');
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.alignItems = 'center';
        element.style.gap = '2px';
        element.style.pointerEvents = 'auto';

        const badge = document.createElement('div');
        const isStopNumber = point.size === 'xl';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.minWidth = isStopNumber ? '48px' : '40px';
        badge.style.height = isStopNumber ? '48px' : '40px';
        badge.style.padding = '0 10px';
        badge.style.borderRadius = '9999px';
        badge.style.border = '3px solid #fff';
        badge.style.backgroundColor = point.color;
        badge.style.color = '#fff';
        badge.style.fontWeight = '900';
        badge.style.fontSize = isStopNumber ? '20px' : '14px';
        badge.style.lineHeight = '1';
        badge.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.35)';
        badge.textContent = point.label;

        const caption = document.createElement('div');
        caption.style.maxWidth = '280px';
        caption.style.width = 'max-content';
        caption.style.whiteSpace = 'normal';
        caption.style.wordBreak = 'break-word';
        caption.style.textAlign = 'center';
        caption.style.borderRadius = '10px';
        caption.style.background = 'rgba(15, 23, 42, 0.88)';
        caption.style.color = '#fff';
        caption.style.fontSize = '12px';
        caption.style.fontWeight = '800';
        caption.style.lineHeight = '1.25';
        caption.style.padding = '4px 10px';
        caption.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.28)';
        caption.textContent = point.subLabel;
        caption.title = point.subLabel;

        element.appendChild(badge);
        element.appendChild(caption);

        const marker = new vietmapgl.Marker({ element, anchor: 'bottom' })
          .setLngLat([Number(point.longitude), Number(point.latitude)])
          .setPopup(new vietmapgl.Popup({ offset: 36 }).setText(point.address))
          .addTo(map);
        markersRef.current.push(marker);
      });

      const routeCoordinates = route?.coordinates || [];
      const waypointsForSplit = [
        ...(start.latitude !== null && start.longitude !== null
          ? [{ longitude: Number(start.longitude), latitude: Number(start.latitude) }]
          : []),
        ...deliveryStops.map(stop => ({
          longitude: Number(stop.longitude),
          latitude: Number(stop.latitude)
        })),
        ...(hasEnd
          ? [{ longitude: Number(end.longitude), latitude: Number(end.latitude) }]
          : [])
      ];
      const legCoordinates = splitRouteIntoLegCoordinates(routeCoordinates, waypointsForSplit);
      const routeGeojson = {
        type: 'FeatureCollection',
        features: legCoordinates.map((coordinates, index) => ({
          type: 'Feature',
          properties: {
            color: legColor(index),
            leg: index + 1
          },
          geometry: {
            type: 'LineString',
            coordinates
          }
        }))
      };

      const source = map.getSource('delivery-route-legs') as any;
      if (source) source.setData(routeGeojson);
      else map.addSource('delivery-route-legs', { type: 'geojson', data: routeGeojson } as any);

      if (!map.getLayer('delivery-route-legs-casing')) {
        map.addLayer({
          id: 'delivery-route-legs-casing',
          type: 'line',
          source: 'delivery-route-legs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 10,
            'line-opacity': 0.9
          }
        } as any);
      }
      if (!map.getLayer('delivery-route-legs-line')) {
        map.addLayer({
          id: 'delivery-route-legs-line',
          type: 'line',
          source: 'delivery-route-legs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 6,
            'line-opacity': 0.95
          }
        } as any);
      }

      // Gỡ layer cũ (một màu) nếu còn sót từ phiên bản trước.
      ['delivery-route-line', 'delivery-route-end-leg-line'].forEach(layerId => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      ['delivery-route', 'delivery-route-end-leg'].forEach(sourceId => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      const boundsPoints = routeCoordinates.length
        ? routeCoordinates
        : points.map(point => [Number(point.longitude), Number(point.latitude)]);
      if (boundsPoints.length > 0) {
        const bounds = new vietmapgl.LngLatBounds(
          boundsPoints[0] as [number, number],
          boundsPoints[0] as [number, number]
        );
        boundsPoints.slice(1).forEach(point => bounds.extend(point as [number, number]));
        map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 500 });
      }
      map.resize();
    };
    if (map.isStyleLoaded?.()) render();
    else map.once('load', render);
  }, [end, route, start, stops]);

  if (!tileKey) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-slate-100 px-6 text-center text-sm font-bold text-slate-500">
        Chưa cấu hình VIETMAP_TILE_KEY nên chưa thể hiển thị bản đồ.
      </div>
    );
  }
  return <div ref={containerRef} className="vietmapgl-map absolute inset-0 h-full w-full" />;
}

export function VietmapRoutePlanner({ date, plate, sourceStops, onSaved }: {
  date: string;
  plate: string;
  sourceStops: DeliveryRouteStop[];
  onSaved: () => Promise<void> | void;
}) {
  const [tileKey, setTileKey] = useState('');
  const [start, setStart] = useState<PointValue>({ address: '', latitude: null, longitude: null });
  const [end, setEnd] = useState<PointValue>({ address: '', latitude: null, longitude: null });
  const [vehicle, setVehicle] = useState('truck');
  const [stops, setStops] = useState<RouteStop[]>(() => sourceStops.map(stop => ({ ...stop, kind: 'request' as const })));
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [manualTotal, setManualTotal] = useState<number | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [addingCustomer, setAddingCustomer] = useState(false);

  useEffect(() => {
    void fetch('/api/vietmap/config').then(readJson).then(payload => setTileKey(payload.tileKey || '')).catch(() => setTileKey(''));
  }, []);
  useEffect(() => {
    void fetch('/api/khach-hang').then(readJson).then(payload => {
      const rows = Array.isArray(payload.customers) ? payload.customers : [];
      setCustomers(rows.map((row: any) => ({
        code: String(row.ma_khach_hang || ''),
        name: String(row.ten_khach_hang || ''),
        address: String(row.dia_chi || row.dia_chi_moi || '')
      })).filter((customer: CustomerRecord) => customer.name));
    }).catch(() => setCustomers([]));
  }, []);

  const sourceStopsKey = sourceStops.map(stop => stop.id).join('|');
  useEffect(() => {
    setStops(current => {
      const sourceById = new Map(sourceStops.map(stop => [stop.id, stop]));
      const merged = current
        .filter(item => item.kind === 'adhoc' || sourceById.has(item.id))
        .map(item => {
          if (item.kind === 'adhoc') return item;
          const stop = sourceById.get(item.id)!;
          return { ...item, title: stop.title, apiKm: stop.apiKm, manualKm: stop.manualKm, order: stop.order };
        });
      const existingIds = new Set(merged.map(item => item.id));
      const additions = sourceStops
        .filter(stop => !existingIds.has(stop.id))
        .map(stop => ({ ...stop, kind: 'request' as const }));
      return [...merged, ...additions];
    });
    setRoute(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceStopsKey]);

  useEffect(() => {
    if (!date || !plate) return;
    let cancelled = false;
    const loadSavedRoute = async () => {
      try {
        const payload = await readJson(await fetch(`/api/tuyen-giao-hang-xe?ngay_tuyen=${encodeURIComponent(date)}&bien_so_xe=${encodeURIComponent(plate)}`));
        if (cancelled) return;
        const row = payload.row;
        const requestStops: RouteStop[] = sourceStops.map((stop, index) => ({
          ...stop,
          kind: 'request' as const,
          order: stop.order ?? index + 1
        }));
        if (!row) {
          setStart({ address: '', latitude: null, longitude: null });
          setEnd({ address: '', latitude: null, longitude: null });
          setVehicle('truck');
          setManualTotal(null);
          setAdjustmentReason('');
          setStops(requestStops);
          setRoute(null);
          return;
        }

        const savedStart: PointValue = {
          address: row.diem_bat_dau || '',
          latitude: row.vi_do_bat_dau == null ? null : Number(row.vi_do_bat_dau),
          longitude: row.kinh_do_bat_dau == null ? null : Number(row.kinh_do_bat_dau)
        };
        const savedEnd: PointValue = {
          address: row.diem_ket_thuc || '',
          latitude: row.vi_do_ket_thuc == null ? null : Number(row.vi_do_ket_thuc),
          longitude: row.kinh_do_ket_thuc == null ? null : Number(row.kinh_do_ket_thuc)
        };
        const savedVehicle = row.loai_phuong_tien || 'truck';
        const savedExtras: RouteStop[] = Array.isArray(row.diem_them) ? row.diem_them.map((item: any) => ({
          id: String(item.id || ''),
          kind: 'adhoc' as const,
          title: String(item.ten_khach_hang || ''),
          address: String(item.dia_chi || ''),
          latitude: item.vi_do == null ? null : Number(item.vi_do),
          longitude: item.kinh_do == null ? null : Number(item.kinh_do),
          apiKm: Number(item.km_vietmap) || 0,
          manualKm: item.km_nhap_tay == null ? null : Number(item.km_nhap_tay),
          maKhachHang: String(item.ma_khach_hang || ''),
          order: Number(item.thu_tu) || 0
        })).filter((item: RouteStop) => item.id) : [];
        const restoredStops = [...requestStops, ...savedExtras]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        setStart(savedStart);
        setEnd(savedEnd);
        setVehicle(savedVehicle);
        setManualTotal(row.tong_km_nhap_tay == null ? null : Number(row.tong_km_nhap_tay));
        setAdjustmentReason(row.ly_do_dieu_chinh || '');
        setStops(restoredStops);
        setRoute(null);

        const routePoints = [
          savedStart,
          ...restoredStops,
          ...(savedEnd.latitude !== null && savedEnd.longitude !== null ? [savedEnd] : [])
        ];
        const canRestoreRoute = savedStart.latitude !== null
          && savedStart.longitude !== null
          && restoredStops.length > 0
          && restoredStops.every(stop => stop.latitude !== null && stop.longitude !== null);
        if (!canRestoreRoute) return;

        setLoading(true);
        const routePayload = await readJson(await fetch('/api/vietmap/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicle: savedVehicle, points: routePoints })
        }));
        if (!cancelled) setRoute(routePayload);
      } catch (loadError: any) {
        if (!cancelled) setError(loadError.message || 'Không thể tải lại đường đi của tuyến.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadSavedRoute();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, plate, sourceStopsKey]);

  const endLegKm = route && end.latitude !== null ? (route.legs[stops.length]?.distanceMeters || 0) / 1000 : 0;
  const calculatedStops = useMemo(() => {
    let cumulative = 0;
    return stops.map((stop, index) => {
      const apiKm = route ? (route.legs[index]?.distanceMeters || 0) / 1000 : stop.apiKm;
      const selectedKm = stop.manualKm === null ? apiKm : stop.manualKm;
      cumulative += selectedKm;
      return { ...stop, apiKm, selectedKm, cumulativeKm: cumulative };
    });
  }, [route, stops]);
  const apiTotalKm = route ? route.distanceMeters / 1000 : calculatedStops.reduce((sum, stop) => sum + stop.apiKm, 0) + endLegKm;
  const calculatedTotalKm = calculatedStops.reduce((sum, stop) => sum + stop.selectedKm, 0) + endLegKm;
  const finalTotalKm = manualTotal === null ? calculatedTotalKm : manualTotal;
  const legendLegs = useMemo(() => {
    const count = route?.legs?.length || Math.max(0, calculatedStops.length);
    return Array.from({ length: count }, (_, index) => ({
      index,
      color: legColor(index),
      label: index < calculatedStops.length
        ? `Chặng ${index + 1} → điểm ${index + 1}`
        : `Chặng ${index + 1} → kết thúc`
    }));
  }, [calculatedStops.length, route?.legs?.length]);

  const moveStop = (index: number, direction: -1 | 1) => {
    setStops(current => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setRoute(null);
  };

  const removeStop = (id: string) => {
    setStops(current => current.filter(item => item.id !== id));
    setRoute(null);
  };

  const addCustomerStop = async (customer: CustomerRecord) => {
    const id = `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const address = customer.address || customer.name;
    setStops(current => [...current, {
      id, kind: 'adhoc', title: customer.name, address, latitude: null, longitude: null,
      apiKm: 0, manualKm: null, maKhachHang: customer.code
    }]);
    setRoute(null);
    if (!address) return;
    setAddingCustomer(true);
    try {
      const suggestions = await readJson(await fetch(`/api/vietmap/autocomplete?text=${encodeURIComponent(address)}`));
      const suggestion = Array.isArray(suggestions.rows) ? suggestions.rows[0] : null;
      if (!suggestion) return;
      const place = await readJson(await fetch(`/api/vietmap/place?refid=${encodeURIComponent(suggestion.refId)}`));
      setStops(current => current.map(item => item.id === id
        ? { ...item, address: place.display || suggestion.display || address, latitude: Number(place.latitude), longitude: Number(place.longitude) }
        : item));
    } catch {
      // Không tự tìm được toạ độ — người dùng chọn tay gợi ý Vietmap ngay trên ô địa chỉ của điểm này.
    } finally {
      setAddingCustomer(false);
    }
  };

  const calculate = async () => {
    const routePoints = [start, ...stops, ...(end.latitude !== null && end.longitude !== null ? [end] : [])];
    if (start.latitude === null || start.longitude === null) return setError('Hãy chọn điểm xuất phát từ danh sách gợi ý Vietmap.');
    const missingIndex = stops.findIndex(stop => stop.latitude === null || stop.longitude === null);
    if (missingIndex !== -1) return setError(`Điểm ${missingIndex + 1} (${stops[missingIndex].title}) chưa có toạ độ Vietmap — hãy bấm vào ô địa chỉ của điểm này rồi chọn 1 gợi ý.`);
    setLoading(true); setError(''); setMessage('');
    try {
      const payload = await readJson(await fetch('/api/vietmap/route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle, points: routePoints })
      }));
      setRoute(payload);
      setMessage(`Đã tính ${routePoints.length} điểm trên tuyến.`);
    } catch (calculateError: any) {
      setError(calculateError.message || 'Không thể tính tuyến Vietmap.');
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!route) {
      const errorText = showSaveFailure(null, 'Hãy bấm “Tính tuyến” trước khi lưu.');
      setError(errorText);
      return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const requestStops = calculatedStops.filter(stop => stop.kind === 'request');
      const adhocStops = calculatedStops.filter(stop => stop.kind === 'adhoc');
      await readJson(await fetch('/api/yeu-cau-xuat-hang-xe/thu-tu', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: requestStops.map(stop => ({
          id: stop.id, thu_tu_giao: calculatedStops.indexOf(stop) + 1, dia_diem_giao: stop.address,
          vi_do: stop.latitude, kinh_do: stop.longitude, km_vietmap: stop.apiKm,
          km_nhap_tay: stop.manualKm, km_chot: stop.selectedKm, km_luy_ke: stop.cumulativeKm
        })) })
      }));
      await readJson(await fetch('/api/tuyen-giao-hang-xe', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngay_tuyen: date, bien_so_xe: plate, diem_bat_dau: start.address,
          vi_do_bat_dau: start.latitude, kinh_do_bat_dau: start.longitude,
          diem_ket_thuc: end.address, vi_do_ket_thuc: end.latitude, kinh_do_ket_thuc: end.longitude,
          loai_phuong_tien: vehicle, tong_km_vietmap: apiTotalKm,
          tong_km_nhap_tay: manualTotal, tong_km_chot: finalTotalKm,
          diem_them: adhocStops.map(stop => ({
            id: stop.id, ma_khach_hang: stop.maKhachHang || '', ten_khach_hang: stop.title,
            dia_chi: stop.address, vi_do: stop.latitude, kinh_do: stop.longitude,
            km_vietmap: stop.apiKm, km_nhap_tay: stop.manualKm, km_chot: stop.selectedKm,
            thu_tu: calculatedStops.indexOf(stop) + 1
          })),
          tong_thoi_gian_phut: route.durationSeconds / 60, ly_do_dieu_chinh: adjustmentReason
        })
      }));
      const successText = 'Đã lưu hành trình và số KM của tuyến.';
      setMessage(successText);
      showAppToast(successText);
      await onSaved();
    } catch (saveError: any) {
      setError(showSaveFailure(saveError, 'Không thể lưu tuyến. Vui lòng thử lại.'));
    } finally { setSaving(false); }
  };

  if (!date || !plate || sourceStops.length === 0) return null;

  return (
    <section className="relative flex min-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex-row">
      <aside className="z-20 flex max-h-[46vh] w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:max-h-none lg:w-[440px] lg:border-b-0 lg:border-r">
        <div className="space-y-3 overflow-y-auto p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Điểm xuất phát</span><AddressPicker value={start} placeholder="Nhập kho hoặc điểm xuất phát..." onChange={value => { setStart(value); setRoute(null); }} /></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Điểm kết thúc (để trống nếu dừng tại khách cuối)</span><AddressPicker value={end} placeholder="Nhập điểm về hoặc kho..." onChange={value => { setEnd(value); setRoute(null); }} /></label>
            <label className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Phương tiện</span><select className={inputClass} value={vehicle} onChange={event => { setVehicle(event.target.value); setRoute(null); }}><option value="truck">Xe tải</option><option value="car">Ô tô</option><option value="motorcycle">Xe máy</option><option value="container">Container</option></select></label>
            <button type="button" onClick={() => void calculate()} disabled={loading} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white hover:bg-red-700 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}Tính tuyến</button>
          </div>

          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p>}

          <div className="space-y-2">
            {calculatedStops.map((stop, index) => (
              <article key={stop.id} className={`rounded-xl border p-3 ${stop.latitude === null ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm font-black text-white shadow"
                      style={{ backgroundColor: legColor(index) }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-900">{stop.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${stop.kind === 'adhoc' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                        {stop.kind === 'adhoc' ? 'Ghé thêm' : 'Yêu cầu xuất hàng'}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-[11px] font-black text-brand-700">Lũy kế {stop.cumulativeKm.toFixed(1)} km</span>
                    <button type="button" title="Lên trên" disabled={index === 0} onClick={() => moveStop(index, -1)} className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button type="button" title="Xuống dưới" disabled={index === calculatedStops.length - 1} onClick={() => moveStop(index, 1)} className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    {stop.kind === 'adhoc' && (
                      <button type="button" title="Xoá điểm ghé thêm" onClick={() => removeStop(stop.id)} className="rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
                <AddressPicker value={{ address: stop.address, latitude: stop.latitude, longitude: stop.longitude }} placeholder="Chọn địa chỉ giao hàng..." onChange={value => { setStops(current => current.map(item => item.id === stop.id ? { ...item, address: value.address, latitude: value.latitude, longitude: value.longitude } : item)); setRoute(null); }} />
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[9px] font-black uppercase text-slate-400">Vietmap</span><strong>{stop.apiKm.toFixed(1)} km</strong></div>
                  <label className="rounded-lg bg-amber-50 p-2"><span className="block text-[9px] font-black uppercase text-amber-700">Nhập tay</span><input type="number" min={0} step={0.1} value={stop.manualKm ?? ''} placeholder="—" onChange={event => setStops(current => current.map(item => item.id === stop.id ? { ...item, manualKm: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0) } : item))} className="mt-0.5 w-full bg-transparent font-black outline-none" /></label>
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800"><span className="block text-[9px] font-black uppercase">KM sử dụng</span><strong>{stop.selectedKm.toFixed(1)} km</strong></div>
                </div>
              </article>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 p-3">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500"><UserPlus className="h-3.5 w-3.5" />Thêm điểm giao (chọn khách hàng)</span>
            <SearchableSelect
              value=""
              onChange={() => undefined}
              options={customers}
              placeholder={addingCustomer ? 'Đang lấy toạ độ Vietmap...' : 'Tìm và chọn khách hàng...'}
              isLoading={addingCustomer}
              getLabel={(item) => (item as CustomerRecord).name}
              getValue={(item) => (item as CustomerRecord).code}
              getSearchText={(item) => {
                const customer = item as CustomerRecord;
                return `${customer.name} ${customer.code} ${customer.address}`;
              }}
              getOptionLabel={(item) => {
                const customer = item as CustomerRecord;
                return customer.address ? `${customer.name} — ${customer.address}` : customer.name;
              }}
              onSelectOption={(item) => { if (item) void addCustomerStop(item as CustomerRecord); }}
            />
          </div>

          {endLegKm > 0 && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">Khách cuối → điểm kết thúc: {endLegKm.toFixed(1)} km</p>}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="grid grid-cols-3 gap-2 text-center"><div><span className="block text-[9px] font-black uppercase text-emerald-700">Vietmap</span><strong>{apiTotalKm.toFixed(1)} km</strong></div><div><span className="block text-[9px] font-black uppercase text-emerald-700">Thời gian</span><strong>{route ? Math.round(route.durationSeconds / 60) : 0} phút</strong></div><div><span className="block text-[9px] font-black uppercase text-emerald-700">KM chốt</span><strong className="text-lg">{finalTotalKm.toFixed(1)} km</strong></div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-[10px] font-black uppercase text-emerald-800">Tổng KM nhập tay<input type="number" min={0} step={0.1} value={manualTotal ?? ''} onChange={event => setManualTotal(event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0))} className={`${inputClass} mt-1`} /></label><label className="text-[10px] font-black uppercase text-emerald-800">Lý do điều chỉnh<input value={adjustmentReason} onChange={event => setAdjustmentReason(event.target.value)} className={`${inputClass} mt-1`} /></label></div>
          </div>
          <button type="button" onClick={() => void save()} disabled={saving || !route} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-xs font-black text-white hover:bg-brand-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu hành trình và số KM</button>
        </div>
      </aside>

      <div className="relative min-h-[54vh] flex-1 bg-slate-100 lg:min-h-0">
        <RouteMap tileKey={tileKey} stops={stops} start={start} end={end} route={route} />
        {legendLegs.length > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-wrap gap-2 lg:right-auto lg:max-w-[70%]">
            {legendLegs.map(leg => (
              <span
                key={leg.index}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black text-slate-700 shadow-md ring-1 ring-slate-200"
              >
                <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: leg.color }} />
                {leg.label}
              </span>
            ))}
          </div>
        )}
        {!route && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
            <p className="rounded-full bg-slate-900/80 px-3 py-1.5 text-[11px] font-bold text-white shadow">
              Bấm “Tính tuyến” để hiện đường đi trên bản đồ
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
