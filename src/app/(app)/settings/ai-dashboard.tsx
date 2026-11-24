"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Gauge,
  Globe,
  MessageSquare,
  Search,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge, Card, CardTitle, EmptyState, StatTile } from "@/components/ui";
import { cn, formatDateTime, formatNumber, normalizeText } from "@/lib/utils";

export type CallRecord = {
  id: string;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "ok" | "error" | "aborted";
  error: string | null;
  createdAt: string;
};

const PALETTE = ["#2a85ff", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const FEATURE_META: Record<string, { label: string; color: string }> = {
  chat: { label: "Trò chuyện AI", color: "#2a85ff" },
  "tool:web_search": { label: "Tìm kiếm web", color: "#06b6d4" },
  capture: { label: "Ghi nhanh", color: "#8b5cf6" },
  "brief:daily": { label: "Bản tin sáng", color: "#f59e0b" },
  "brief:weekly": { label: "Bản tin tuần", color: "#f59e0b" },
  "item:evaluate": { label: "Đánh giá mục", color: "#10b981" },
  "item:summarize": { label: "Tóm tắt mục", color: "#10b981" },
  "item:breakdown": { label: "Chia nhỏ việc", color: "#ec4899" },
  "item:improve": { label: "Viết lại nội dung", color: "#6366f1" },
};

function featureLabel(key: string): string {
  return FEATURE_META[key]?.label ?? key;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return formatNumber(n);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dayKeyLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type RangeKey = "24h" | "7d" | "14d";
type MetricKey = "tokens" | "calls" | "latency";
type BreakdownMode = "model" | "feature";

export function AIDashboard({ calls }: { calls: CallRecord[] }) {
  // Nếu toàn bộ cuộc gọi nằm gọn trong 24 giờ thì mặc định xem theo giờ cho biểu đồ sinh động.
  // So khoảng cách giữa lần gọi mới nhất và cũ nhất (không dùng Date.now() trong lúc render).
  const defaultRange = useMemo<RangeKey>(() => {
    if (calls.length === 0) return "7d";
    const newest = new Date(calls[0].createdAt).getTime();
    const oldest = new Date(calls[calls.length - 1].createdAt).getTime();
    return newest - oldest < 24 * 60 * 60 * 1000 ? "24h" : "7d";
  }, [calls]);

  const [range, setRange] = useState<RangeKey>(defaultRange);
  const [metric, setMetric] = useState<MetricKey>("tokens");
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("model");
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [hoveredLatency, setHoveredLatency] = useState<number | null>(null);

  // Bộ lọc & phân trang bảng nhật ký
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "error">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);

  // ── KPI tổng quan ──
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = dayKeyLocal(now);
    let totalIn = 0;
    let totalOut = 0;
    let totalDuration = 0;
    let okCount = 0;
    let errCount = 0;
    let todayCalls = 0;
    let fastestMs = Infinity;

    for (const c of calls) {
      totalIn += c.inputTokens;
      totalOut += c.outputTokens;
      totalDuration += c.durationMs;
      if (c.status === "ok") okCount++;
      else if (c.status === "error") errCount++;
      if (dayKeyLocal(new Date(c.createdAt)) === todayStr) todayCalls++;
      if (c.durationMs > 0 && c.durationMs < fastestMs) fastestMs = c.durationMs;
    }

    const totalCalls = calls.length;
    const avgSec = totalCalls > 0 ? totalDuration / totalCalls / 1000 : 0;
    const okRate = totalCalls > 0 ? Math.round((okCount / totalCalls) * 100) : 100;
    return {
      totalCalls,
      todayCalls,
      totalTokens: totalIn + totalOut,
      totalIn,
      totalOut,
      avgSec,
      fastestSec: Number.isFinite(fastestMs) ? fastestMs / 1000 : 0,
      okCount,
      errCount,
      okRate,
    };
  }, [calls]);

  // ── Dữ liệu biểu đồ cột theo thời gian ──
  const timeSeries = useMemo(() => {
    const now = new Date();
    type Bucket = {
      key: string;
      label: string;
      fullLabel: string;
      calls: number;
      inputTokens: number;
      outputTokens: number;
      totalDurationMs: number;
    };
    const buckets: Bucket[] = [];
    const map = new Map<string, Bucket>();

    if (range === "24h") {
      // 12 khung 2 giờ chẵn (00–01, 02–03, ..., 22–23) trong 24h gần nhất
      const currentSlot = Math.floor(now.getHours() / 2);
      const latestSlotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentSlot * 2);
      for (let i = 11; i >= 0; i--) {
        const slotStart = new Date(latestSlotStart.getTime() - i * 2 * 60 * 60 * 1000);
        const h1 = slotStart.getHours();
        const h2 = h1 + 1;
        const key = `${dayKeyLocal(slotStart)}-${Math.floor(h1 / 2)}`;
        const b: Bucket = {
          key,
          label: `${pad2(h1)}h`,
          fullLabel: `${pad2(h1)}:00 – ${pad2(h2)}:59 (${pad2(slotStart.getDate())}/${pad2(slotStart.getMonth() + 1)})`,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalDurationMs: 0,
        };
        buckets.push(b);
        map.set(key, b);
      }
      for (const c of calls) {
        const d = new Date(c.createdAt);
        const key = `${dayKeyLocal(d)}-${Math.floor(d.getHours() / 2)}`;
        const b = map.get(key);
        if (!b) continue;
        b.calls++;
        b.inputTokens += c.inputTokens;
        b.outputTokens += c.outputTokens;
        b.totalDurationMs += c.durationMs;
      }
    } else {
      const days = range === "7d" ? 7 : 14;
      const todayKey = dayKeyLocal(now);
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = dayKeyLocal(d);
        const shortDate = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
        const b: Bucket = {
          key,
          label: key === todayKey ? "Hôm nay" : shortDate,
          fullLabel: key === todayKey ? `Hôm nay (${shortDate})` : `Ngày ${shortDate}/${d.getFullYear()}`,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalDurationMs: 0,
        };
        buckets.push(b);
        map.set(key, b);
      }
      for (const c of calls) {
        const key = dayKeyLocal(new Date(c.createdAt));
        const b = map.get(key);
        if (!b) continue;
        b.calls++;
        b.inputTokens += c.inputTokens;
        b.outputTokens += c.outputTokens;
        b.totalDurationMs += c.durationMs;
      }
    }

    return buckets.map((b) => ({
      ...b,
      totalTokens: b.inputTokens + b.outputTokens,
      avgSec: b.calls > 0 ? b.totalDurationMs / b.calls / 1000 : 0,
    }));
  }, [calls, range]);

  // ── Phân bổ Donut theo Model / Tính năng ──
  const breakdown = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; calls: number; tokens: number; color: string }>();
    for (const c of calls) {
      const key = breakdownMode === "model" ? `${c.provider}/${c.model}` : c.feature;
      const existing = groups.get(key);
      const tokens = c.inputTokens + c.outputTokens;
      if (existing) {
        existing.calls++;
        existing.tokens += tokens;
      } else {
        groups.set(key, {
          key,
          label: breakdownMode === "model" ? c.model : featureLabel(c.feature),
          calls: 1,
          tokens,
          color:
            breakdownMode === "feature" && FEATURE_META[c.feature]?.color
              ? FEATURE_META[c.feature].color
              : PALETTE[groups.size % PALETTE.length],
        });
      }
    }
    const list = [...groups.values()].sort((a, b) => b.tokens - a.tokens);
    const totalTokens = list.reduce((s, x) => s + x.tokens, 0) || 1;
    return list.map((item, i) => ({
      ...item,
      color: breakdownMode === "model" ? PALETTE[i % PALETTE.length] : item.color,
      pct: Math.round((item.tokens / totalTokens) * 100),
    }));
  }, [calls, breakdownMode]);

  // ── Chuỗi độ trễ 20 lượt gọi gần nhất (từ cũ -> mới) ──
  const recentLatency = useMemo(() => {
    return calls
      .slice(0, 20)
      .reverse()
      .map((c, idx) => ({
        idx,
        sec: c.durationMs / 1000,
        model: c.model,
        feature: featureLabel(c.feature),
        tokens: c.inputTokens + c.outputTokens,
        status: c.status,
        time: formatDateTime(c.createdAt),
      }));
  }, [calls]);

  // ── Bảng xếp hạng hiệu suất theo tính năng ──
  const featureStats = useMemo(() => {
    const map = new Map<string, { key: string; label: string; calls: number; tokens: number; totalMs: number; color: string }>();
    for (const c of calls) {
      const existing = map.get(c.feature);
      const tokens = c.inputTokens + c.outputTokens;
      if (existing) {
        existing.calls++;
        existing.tokens += tokens;
        existing.totalMs += c.durationMs;
      } else {
        map.set(c.feature, {
          key: c.feature,
          label: featureLabel(c.feature),
          calls: 1,
          tokens,
          totalMs: c.durationMs,
          color: FEATURE_META[c.feature]?.color ?? PALETTE[map.size % PALETTE.length],
        });
      }
    }
    const list = [...map.values()].sort((a, b) => b.calls - a.calls);
    const maxCalls = list[0]?.calls || 1;
    return list.map((x) => ({
      ...x,
      avgSec: x.calls > 0 ? x.totalMs / x.calls / 1000 : 0,
      barPct: Math.max(8, Math.round((x.calls / maxCalls) * 100)),
    }));
  }, [calls]);

  // ── Danh sách nhật ký có bộ lọc & phân trang ──
  const filteredLog = useMemo(() => {
    const q = normalizeText(query.trim());
    return calls.filter((c) => {
      if (statusFilter === "ok" && c.status !== "ok") return false;
      if (statusFilter === "error" && c.status === "ok") return false;
      if (providerFilter !== "all" && c.provider !== providerFilter) return false;
      if (q) {
        const hay = normalizeText(`${c.model} ${c.provider} ${c.feature} ${featureLabel(c.feature)}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, statusFilter, providerFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredLog.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filteredLog.slice(pageStart, pageStart + pageSize);
  const pageNumbers = useMemo(() => buildPageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  if (calls.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState title="Chưa có dữ liệu sử dụng AI">
          Hãy thử trò chuyện với Trợ lý AI hoặc tạo bản tin để bắt đầu ghi nhận thống kê và biểu đồ tại đây.
        </EmptyState>
      </Card>
    );
  }

  // Giá trị max cho biểu đồ cột
  const maxBarVal = Math.max(
    1,
    ...timeSeries.map((b) => (metric === "tokens" ? b.totalTokens : metric === "calls" ? b.calls : b.avgSec)),
  );
  const activeBucket = hoveredBucket !== null ? timeSeries[hoveredBucket] : null;

  // Tham số cho Donut SVG
  const donutRadius = 56;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const totalBreakdownTokens = breakdown.reduce((s, x) => s + x.tokens, 0) || 1;
  const activeSlice = hoveredSlice !== null ? breakdown[hoveredSlice] : null;

  // Tham số cho biểu đồ đường độ trễ
  const latMax = Math.max(2, ...recentLatency.map((x) => x.sec)) * 1.15;
  const latAvg = recentLatency.reduce((s, x) => s + x.sec, 0) / (recentLatency.length || 1);
  const latW = 520;
  const latH = 170;
  const latPadX = 16;
  const latPadY = 18;
  const latPoints = recentLatency.map((pt, i) => {
    const x =
      recentLatency.length === 1
        ? latW / 2
        : latPadX + (i / (recentLatency.length - 1)) * (latW - latPadX * 2);
    const y = latH - latPadY - (pt.sec / latMax) * (latH - latPadY * 2);
    return { ...pt, x, y };
  });
  const latLinePath = latPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const latAreaPath =
    latPoints.length > 0
      ? `${latLinePath} L${latPoints[latPoints.length - 1].x.toFixed(1)},${(latH - latPadY).toFixed(1)} L${latPoints[0].x.toFixed(1)},${(latH - latPadY).toFixed(1)} Z`
      : "";
  const latAvgY = latH - latPadY - (latAvg / latMax) * (latH - latPadY * 2);

  return (
    <div className="flex flex-col gap-4">
      {/* Hàng KPI 4 thẻ màu pastel đồng bộ với trang Tổng quan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Activity}
          tint="sky"
          title="Tổng lượt gọi AI"
          value={formatNumber(stats.totalCalls)}
          sub={`Hôm nay: ${formatNumber(stats.todayCalls)} lượt`}
        />
        <StatTile
          icon={Cpu}
          tint="purple"
          title="Tổng Token"
          value={formatCompact(stats.totalTokens)}
          sub={`Vào: ${formatCompact(stats.totalIn)} · Ra: ${formatCompact(stats.totalOut)}`}
        />
        <StatTile
          icon={Gauge}
          tint="amber"
          title="Tốc độ TB"
          value={`${stats.avgSec.toFixed(1)}s`}
          sub={`Nhanh nhất: ${stats.fastestSec.toFixed(1)}s`}
        />
        <StatTile
          icon={CheckCircle2}
          tint="emerald"
          title="Tỉ lệ thành công"
          value={`${stats.okRate}%`}
          sub={`${formatNumber(stats.okCount)} OK · ${formatNumber(stats.errCount)} lỗi`}
        />
      </div>

      {/* Hàng biểu đồ chính: Cột lưu lượng + Donut phân bổ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Biểu đồ cột tương tác */}
        <Card className="flex flex-col p-5 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Hoạt động & lưu lượng AI</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Di chuột vào từng cột để xem chi tiết token vào/ra và tốc độ phản hồi
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-muted p-0.5 text-xs font-semibold">
                {(
                  [
                    ["tokens", "Token"],
                    ["calls", "Lượt gọi"],
                    ["latency", "Độ trễ"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMetric(k)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 transition-colors",
                      metric === k ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-xl bg-muted p-0.5 text-xs font-semibold">
                {(
                  [
                    ["24h", "24 giờ"],
                    ["7d", "7 ngày"],
                    ["14d", "14 ngày"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRange(k)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 transition-colors",
                      range === k ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Thanh thông số động khi rê chuột */}
          <div className="mt-4 flex min-h-8 flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3.5 py-2 text-xs">
            {activeBucket ? (
              <>
                <span className="font-bold text-foreground">{activeBucket.fullLabel}</span>
                <div className="flex flex-wrap items-center gap-3 tabular-nums">
                  <span>
                    <strong className="text-foreground">{formatNumber(activeBucket.calls)}</strong> lượt
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#2a85ff]" />
                    Vào: <strong className="text-foreground">{formatNumber(activeBucket.inputTokens)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
                    Ra: <strong className="text-foreground">{formatNumber(activeBucket.outputTokens)}</strong>
                  </span>
                  <span>
                    TB: <strong className="text-foreground">{activeBucket.avgSec.toFixed(1)}s</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {metric === "tokens"
                    ? "Token vào (xanh dương) & Token ra (tím)"
                    : metric === "calls"
                      ? "Tổng số lượt gọi AI theo mốc thời gian"
                      : "Thời gian phản hồi trung bình (giây)"}
                </span>
                {metric === "tokens" && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#2a85ff]" /> Token vào
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#8b5cf6]" /> Token ra
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Vùng vẽ cột */}
          <div className="mt-4 flex h-56 items-end gap-1.5 pt-2 sm:gap-2">
            {timeSeries.map((b, i) => {
              const val = metric === "tokens" ? b.totalTokens : metric === "calls" ? b.calls : b.avgSec;
              const heightPct = val > 0 ? Math.max(6, (val / maxBarVal) * 100) : 0;
              const outRatio = b.totalTokens > 0 ? (b.outputTokens / b.totalTokens) * 100 : 0;
              const isHovered = hoveredBucket === i;

              return (
                <div
                  key={b.key}
                  onMouseEnter={() => setHoveredBucket(i)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                >
                  <div className="relative flex h-full w-full items-end justify-center rounded-xl bg-muted/30 px-1 pt-4 transition-colors group-hover:bg-muted/70">
                    {/* Nhãn số liệu phía trên cột khi có giá trị */}
                    {val > 0 && (
                      <span
                        className={cn(
                          "pointer-events-none absolute top-1 text-[10px] font-semibold tabular-nums transition-opacity",
                          isHovered ? "text-foreground opacity-100" : "text-muted-foreground opacity-80",
                        )}
                      >
                        {metric === "tokens" ? formatCompact(val) : metric === "calls" ? val : `${val.toFixed(1)}s`}
                      </span>
                    )}
                    {heightPct > 0 ? (
                      metric === "tokens" ? (
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={cn(
                            "flex w-full max-w-9 flex-col overflow-hidden rounded-t-lg transition-all duration-300",
                            isHovered && "brightness-110",
                          )}
                        >
                          <div style={{ height: `${outRatio}%` }} className="w-full bg-[#8b5cf6]" />
                          <div className="w-full flex-1 bg-[#2a85ff]" />
                        </div>
                      ) : (
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={cn(
                            "w-full max-w-9 rounded-t-lg transition-all duration-300",
                            metric === "calls" ? "bg-[#2a85ff]" : "bg-[#f59e0b]",
                            isHovered && "brightness-110",
                          )}
                        />
                      )
                    ) : (
                      <div className="h-1 w-full max-w-9 rounded-full bg-border/60" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "w-full truncate text-center text-[11px] tabular-nums",
                      isHovered ? "font-bold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Biểu đồ Donut phân bổ Model / Tính năng */}
        <Card className="flex flex-col p-5 xl:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Phân bổ sử dụng</h2>
            <div className="inline-flex rounded-xl bg-muted p-0.5 text-xs font-semibold">
              {(
                [
                  ["model", "Model"],
                  ["feature", "Tính năng"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setBreakdownMode(k);
                    setHoveredSlice(null);
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 transition-colors",
                    breakdownMode === k ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="my-4 flex flex-col items-center justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
                <circle cx="72" cy="72" r={donutRadius} fill="none" stroke="var(--muted)" strokeWidth="18" />
                {(() => {
                  // Độ dài từng lát và điểm bắt đầu cộng dồn, tính trước (không gán lại biến trong lúc render)
                  const lens = breakdown.map((item) => (item.tokens / totalBreakdownTokens) * donutCircumference);
                  const starts = lens.map((_, i) => lens.slice(0, i).reduce((sum, l) => sum + l, 0));
                  return breakdown.map((item, idx) => {
                    const len = lens[idx];
                    const dashOffset = -starts[idx];
                    const dimmed = hoveredSlice !== null && hoveredSlice !== idx;
                    return (
                      <circle
                        key={item.key}
                        cx="72"
                        cy="72"
                        r={donutRadius}
                        fill="none"
                        stroke={item.color}
                        strokeWidth={hoveredSlice === idx ? 21 : 18}
                        strokeDasharray={`${Math.max(0, len - 1.5)} ${donutCircumference}`}
                        strokeDashoffset={dashOffset}
                        className="cursor-pointer transition-all duration-200"
                        style={{ opacity: dimmed ? 0.3 : 1 }}
                        onMouseEnter={() => setHoveredSlice(idx)}
                        onMouseLeave={() => setHoveredSlice(null)}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                <span className="text-xl font-bold tabular-nums leading-none text-foreground">
                  {activeSlice ? `${activeSlice.pct}%` : formatCompact(stats.totalTokens)}
                </span>
                <span className="mt-1 max-w-24 truncate text-[11px] font-medium text-muted-foreground">
                  {activeSlice ? activeSlice.label : "tổng token"}
                </span>
              </div>
            </div>
          </div>

          <ul className="mt-auto space-y-1.5">
            {breakdown.slice(0, 6).map((item, idx) => (
              <li
                key={item.key}
                onMouseEnter={() => setHoveredSlice(idx)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-colors",
                  hoveredSlice === idx ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate font-semibold text-foreground">{item.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <strong className="text-foreground">{formatCompact(item.tokens)}</strong> · {item.calls} lượt
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Hàng biểu đồ phụ: Độ trễ 20 lượt gần nhất + Hiệu suất theo tính năng */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Area Sparkline độ trễ */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Biến động tốc độ phản hồi</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {recentLatency.length} lượt gọi gần nhất · Đường đứt nét là trung bình ({latAvg.toFixed(1)}s)
              </p>
            </div>
            {hoveredLatency !== null && recentLatency[hoveredLatency] && (
              <div className="rounded-xl bg-muted px-2.5 py-1 text-right text-xs">
                <div className="font-bold tabular-nums text-foreground">
                  {recentLatency[hoveredLatency].sec.toFixed(1)}s · {recentLatency[hoveredLatency].model}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {recentLatency[hoveredLatency].feature} · {formatNumber(recentLatency[hoveredLatency].tokens)} token
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <svg viewBox={`0 0 ${latW} ${latH}`} className="h-44 w-full overflow-visible">
              <defs>
                <linearGradient id="aiLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2a85ff" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2a85ff" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Đường trung bình */}
              <line
                x1={latPadX}
                x2={latW - latPadX}
                y1={latAvgY}
                y2={latAvgY}
                stroke="var(--border-strong)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x={latW - latPadX} y={latAvgY - 5} textAnchor="end" className="fill-muted-foreground text-[10px]">
                TB {latAvg.toFixed(1)}s
              </text>

              {/* Vùng màu & đường nối */}
              {latAreaPath && <path d={latAreaPath} fill="url(#aiLatencyGrad)" />}
              {latLinePath && (
                <path
                  d={latLinePath}
                  fill="none"
                  stroke="#2a85ff"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Các điểm dữ liệu tương tác */}
              {latPoints.map((p, idx) => {
                const active = hoveredLatency === idx;
                const dotColor = p.status === "error" ? "#ef4444" : p.sec > 10 ? "#f59e0b" : "#2a85ff";
                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredLatency(idx)}
                    onMouseLeave={() => setHoveredLatency(null)}
                  >
                    <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={active ? 5.5 : 3.5}
                      fill={dotColor}
                      stroke="var(--card)"
                      strokeWidth="2"
                      className="transition-all"
                    />
                  </g>
                );
              })}
            </svg>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Cũ hơn ({recentLatency[0]?.time})</span>
              <span>Mới nhất ({recentLatency[recentLatency.length - 1]?.time})</span>
            </div>
          </div>
        </Card>

        {/* Thanh ngang phân tích theo tính năng */}
        <Card className="p-5">
          <h2 className="text-lg font-bold">Hiệu suất theo tính năng</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">So sánh số lượt dùng, tổng token và thời gian trung bình</p>

          <ul className="mt-4 space-y-3.5">
            {featureStats.map((f) => (
              <li key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                    <FeatureIcon feature={f.key} color={f.color} />
                    <span className="truncate">{f.label}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    <strong className="text-foreground">{formatNumber(f.calls)}</strong> lượt · {formatCompact(f.tokens)} token ·{" "}
                    {f.avgSec.toFixed(1)}s
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${f.barPct}%`, backgroundColor: f.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Bảng nhật ký gọi AI có lọc trực tiếp */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <CardTitle>Nhật ký gọi AI</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc trạng thái */}
            <div className="inline-flex rounded-xl bg-muted p-0.5 text-xs font-semibold">
              {(
                [
                  ["all", "Tất cả"],
                  ["ok", "OK"],
                  ["error", "Lỗi / Dừng"],
                ] as const
              ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setStatusFilter(k);
                      setPage(1);
                    }}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 transition-colors",
                      statusFilter === k ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Lọc hãng */}
              <div className="inline-flex rounded-xl bg-muted p-0.5 text-xs font-semibold">
                {(
                  [
                    ["all", "Mọi hãng"],
                    ["openai", "OpenAI"],
                    ["gemini", "Gemini"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setProviderFilter(k);
                      setPage(1);
                    }}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 transition-colors",
                      providerFilter === k ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Ô tìm kiếm */}
              <div className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 text-xs">
                <Search size={13} className="text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Lọc model, tính năng..."
                  className="w-36 bg-transparent text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground"
                />
              </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredLog.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Không có bản ghi nào khớp bộ lọc.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Thời gian</th>
                  <th className="px-4 py-2.5 font-semibold">Tính năng</th>
                  <th className="px-4 py-2.5 font-semibold">Model</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Token vào / ra</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tốc độ</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map((c) => {
                  const total = c.inputTokens + c.outputTokens || 1;
                  const inPct = Math.round((c.inputTokens / total) * 100);
                  const sec = c.durationMs / 1000;
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-hover/60">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                          <FeatureIcon feature={c.feature} color={FEATURE_META[c.feature]?.color ?? "#2a85ff"} />
                          {featureLabel(c.feature)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 py-1 text-xs font-semibold">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              c.provider === "gemini" ? "bg-[#2a85ff]" : "bg-emerald-500",
                            )}
                          />
                          <span className="text-muted-foreground">{c.provider}/</span>
                          <span className="text-foreground">{c.model}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <div className="inline-flex flex-col items-end gap-1">
                          <span className="text-xs">
                            <strong className="text-foreground">{formatNumber(c.inputTokens)}</strong>
                            <span className="text-muted-foreground"> / {formatNumber(c.outputTokens)}</span>
                          </span>
                          <span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <span style={{ width: `${inPct}%` }} className="bg-[#2a85ff]" />
                            <span className="flex-1 bg-[#8b5cf6]" />
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <span
                          className={cn(
                            "text-xs font-bold",
                            sec > 10 ? "text-danger" : sec > 5 ? "text-warning" : "text-success",
                          )}
                        >
                          {sec.toFixed(1)}s
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {c.status === "ok" ? (
                          <Badge tone="success">OK</Badge>
                        ) : c.status === "aborted" ? (
                          <Badge>Đã dừng</Badge>
                        ) : (
                          <Badge tone="danger" title={c.error ?? ""}>
                            Lỗi
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Thanh phân trang */}
        {filteredLog.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span className="tabular-nums">
                Hiển thị{" "}
                <strong className="text-foreground">
                  {formatNumber(pageStart + 1)}–{formatNumber(Math.min(pageStart + pageSize, filteredLog.length))}
                </strong>{" "}
                trên <strong className="text-foreground">{formatNumber(filteredLog.length)}</strong> lượt
              </span>
              <div className="inline-flex items-center gap-1.5">
                <span>Mỗi trang:</span>
                <div className="inline-flex rounded-lg bg-muted p-0.5 font-semibold">
                  {([10, 20, 50] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setPageSize(sz);
                        setPage(1);
                      }}
                      className={cn(
                        "cursor-pointer rounded-md px-2 py-0.5 transition-colors tabular-nums",
                        pageSize === sz ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <nav aria-label="Phân trang nhật ký AI" className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>

              {pageNumbers.map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-1.5 text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    aria-current={item === currentPage ? "page" : undefined}
                    onClick={() => setPage(item)}
                    className={cn(
                      "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors",
                      item === currentPage
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "border border-transparent text-foreground hover:border-border hover:bg-card",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Trang sau"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </nav>
          </div>
        )}
      </Card>
    </div>
  );
}

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

function FeatureIcon({ feature, color }: { feature: string; color: string }) {
  const Icon =
    feature === "chat"
      ? MessageSquare
      : feature === "tool:web_search"
        ? Globe
        : feature === "capture"
          ? Zap
          : feature.startsWith("brief")
            ? Sparkles
            : Wrench;
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}1a`, color }}
      aria-hidden="true"
    >
      <Icon size={13} />
    </span>
  );
}
