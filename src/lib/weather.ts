/**
 * Tra cứu thời tiết thực tế & dự báo nhiều ngày qua Open-Meteo (miễn phí, không cần API key).
 */
import "server-only";

const WEATHER_LABELS: Record<number, string> = {
  0: "Trời quang",
  1: "Chủ yếu quang mây",
  2: "Có mây rải rác",
  3: "Nhiều mây",
  45: "Có sương mù",
  48: "Sương mù đọng băng",
  51: "Mưa phùn nhẹ",
  53: "Mưa phùn vừa",
  55: "Mưa phùn dày",
  56: "Mưa phùn lạnh nhẹ",
  57: "Mưa phùn lạnh dày",
  61: "Mưa nhẹ",
  63: "Mưa vừa",
  65: "Mưa to",
  66: "Mưa lạnh nhẹ",
  67: "Mưa lạnh to",
  71: "Tuyết nhẹ",
  73: "Tuyết vừa",
  75: "Tuyết dày",
  77: "Mưa tuyết hạt",
  80: "Mưa rào nhẹ",
  81: "Mưa rào vừa",
  82: "Mưa rào to",
  85: "Mưa tuyết nhẹ",
  86: "Mưa tuyết to",
  95: "Có dông",
  96: "Dông kèm mưa đá nhẹ",
  99: "Dông kèm mưa đá to",
};

const CITY_ALIASES: Record<string, string> = {
  hcm: "Ho Chi Minh City",
  tphcm: "Ho Chi Minh City",
  "tp hcm": "Ho Chi Minh City",
  "tp.hcm": "Ho Chi Minh City",
  "tp. hcm": "Ho Chi Minh City",
  "ho chi minh": "Ho Chi Minh City",
  "sai gon": "Ho Chi Minh City",
  saigon: "Ho Chi Minh City",
  hn: "Hanoi",
  "ha noi": "Hanoi",
  dn: "Da Nang",
  "da nang": "Da Nang",
  hp: "Hai Phong",
  "hai phong": "Hai Phong",
  ct: "Can Tho",
  "can tho": "Can Tho",
};

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function weatherLabel(code: number | undefined): string {
  if (typeof code !== "number") return "Không rõ";
  return WEATHER_LABELS[code] ?? `Mã thời tiết ${code}`;
}

type GeoResult = {
  name: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(8000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(url, { signal: combined, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function geocode(rawLocation: string, signal?: AbortSignal): Promise<GeoResult | null> {
  const trimmed = rawLocation.trim();
  if (!trimmed) return null;
  const normalized = stripDiacritics(trimmed);
  const alias = CITY_ALIASES[normalized];

  const candidates = Array.from(new Set([alias, trimmed, normalized].filter((v): v is string => Boolean(v))));
  for (const query of candidates) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=vi&format=json`;
    const data = await fetchJson<{ results?: GeoResult[] }>(url, signal);
    const results = data.results ?? [];
    if (results.length > 0) {
      // Nếu người dùng không nêu nước khác và có kết quả tại Việt Nam, ưu tiên Việt Nam
      const vn = results.find((r) => r.country_code === "VN");
      return vn && !trimmed.includes(",") ? vn : results[0];
    }
  }
  return null;
}

export async function fetchWeather(location: string, days = 5, signal?: AbortSignal) {
  const place = await geocode(location, signal);
  if (!place) {
    return { error: `Không tìm thấy địa điểm “${location}”. Hãy thử tên thành phố rõ hơn (ví dụ: Hà Nội, TP.HCM, Đà Nẵng).` };
  }

  const forecastDays = Math.min(10, Math.max(1, Math.round(days) || 5));
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    forecast_days: String(forecastDays),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
  });

  const data = await fetchJson<{
    timezone?: string;
    current?: {
      time?: string;
      temperature_2m?: number;
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      precipitation?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
      wind_speed_10m_max?: number[];
    };
  }>(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, signal);

  const daily = (data.daily?.time ?? []).map((date, i) => ({
    date,
    condition: weatherLabel(data.daily?.weather_code?.[i]),
    minC: data.daily?.temperature_2m_min?.[i],
    maxC: data.daily?.temperature_2m_max?.[i],
    rainProbPct: data.daily?.precipitation_probability_max?.[i],
    rainMm: data.daily?.precipitation_sum?.[i],
    maxWindKmh: data.daily?.wind_speed_10m_max?.[i],
  }));

  return {
    source: "Open-Meteo",
    location: {
      name: place.name,
      region: place.admin1 ?? null,
      country: place.country ?? null,
      timezone: data.timezone ?? place.timezone ?? null,
    },
    current: data.current
      ? {
          time: data.current.time,
          condition: weatherLabel(data.current.weather_code),
          tempC: data.current.temperature_2m,
          feelsLikeC: data.current.apparent_temperature,
          humidityPct: data.current.relative_humidity_2m,
          precipitationMm: data.current.precipitation,
          windKmh: data.current.wind_speed_10m,
        }
      : null,
    daily,
  };
}
