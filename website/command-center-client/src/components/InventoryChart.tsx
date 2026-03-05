"use client";

import { useMemo, useRef, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import gsap from "gsap";
import { InventoryRecord } from "@/hooks/useInventory";

interface InventoryChartProps {
  records: InventoryRecord[];
  loading: boolean;
  depletionRate: number | null;
}

/* ── colour tokens (S.H.I.E.L.D. palette) ───────────── */
const STOCK_COLOR = "#2dd4bf"; // teal/cyan accent
const USAGE_COLOR = "#818cf8"; // indigo-400
const SNAP_COLOR = "#ef4444"; // red-500
const RESTOCK_COLOR = "#22c55e"; // green-500
const PRED_STOCK_COLOR = "#facc15"; // yellow-400 — prediction
const PRED_USAGE_COLOR = "#f472b6"; // pink-400 — prediction
const GRID_COLOR = "rgba(255,255,255,0.04)";
const AXIS_COLOR = "#475569"; // slate-600

/* ── helpers ───────────────────────────────────────── */
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AggBucket {
  time: string;
  sortKey: number;
  stockSum: number;
  usageSum: number;
  count: number;
  hasSnap: boolean;
  hasRestock: boolean;
  restockReason: string;
}

/** Group raw records by timestamp → one averaged point per timestamp */
function aggregateRecords(records: InventoryRecord[]) {
  const bucketMap = new Map<string, AggBucket>();

  for (const r of records) {
    const time = formatTime(r.timestamp);
    let bucket = bucketMap.get(time);
    if (!bucket) {
      bucket = {
        time,
        sortKey: new Date(r.timestamp).getTime(),
        stockSum: 0,
        usageSum: 0,
        count: 0,
        hasSnap: false,
        hasRestock: false,
        restockReason: "",
      };
      bucketMap.set(time, bucket);
    }
    bucket.stockSum += r.stock_level;
    bucket.usageSum += r.usage_rate_hourly;
    bucket.count += 1;
    if (r.snap_event_detected) bucket.hasSnap = true;
    if (r.restock_reason && r.restock_reason.length > 0) {
      bucket.hasRestock = true;
      bucket.restockReason = r.restock_reason;
    }
  }

  const sorted = [...bucketMap.values()].sort((a, b) => a.sortKey - b.sortKey);

  const snapTimes: string[] = [];
  const restockEvents: { time: string; reason: string }[] = [];

  const data = sorted.map((b) => {
    const avgStock = b.stockSum / b.count;
    const avgUsage = b.usageSum / b.count;

    if (b.hasSnap) snapTimes.push(b.time);
    if (b.hasRestock) {
      restockEvents.push({ time: b.time, reason: b.restockReason });
    }

    return {
      time: b.time,
      sortKey: b.sortKey,
      stock_level: Math.round(avgStock * 100) / 100,
      usage_rate_hourly: Math.round(avgUsage * 100) / 100,
      hasSnap: b.hasSnap,
      hasRestock: b.hasRestock,
      restock_dot: b.hasRestock ? Math.round(avgStock * 100) / 100 : null,
      restock_reason: b.restockReason || null,
    };
  });

  return { data, snapTimes, restockEvents };
}

/* ── custom tooltip ────────────────────────────────── */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  const hasSnap = row?.hasSnap;
  const isPrediction = row?.isPrediction;
  const rawReason = row?.restock_reason;
  const restockReason = typeof rawReason === "string"
    ? rawReason.split(",")[0].trim()
    : rawReason;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/95 px-4 py-3 text-xs shadow-xl backdrop-blur">
      <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--accent)]">
        {label}
        {!!isPrediction && <span className="ml-2 text-[#facc15]">⟨FORECAST⟩</span>}
      </p>
      {payload
        .filter((p) => ["stock_level", "usage_rate_hourly", "predicted_stock", "predicted_usage"].includes(p.dataKey))
        .filter((p) => p.value != null)
        .map((p) => {
          const isPred = p.dataKey.startsWith("predicted_");
          const labelText = p.dataKey === "stock_level" ? "Stock Level"
            : p.dataKey === "usage_rate_hourly" ? "Usage / hr"
            : p.dataKey === "predicted_stock" ? "Stock (Predicted)"
            : "Usage (Projected)";
          return (
            <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.color }}
              />
              <span className={isPred ? "text-[#facc15]/70" : "text-[var(--text-muted)]"}>
                {labelText}:
              </span>
              <span className="font-medium text-[var(--text-primary)]">
                {p.value?.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          );
        })}
      {!!isPrediction && row?.slopeValue != null && (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 font-mono text-[10px] font-medium tracking-wider text-[#facc15]">
          📉 Depletion Rate: <span className="font-semibold">{Number(row.slopeValue).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span> <span className="text-[var(--text-muted)]">/hr</span>
        </p>
      )}
      {hasSnap ? (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 font-mono text-[10px] font-semibold tracking-wider text-red-400">
          ⚡ SNAP EVENT
        </p>
      ) : null}
      {restockReason ? (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 font-mono text-[10px] font-semibold tracking-wider text-green-400">
          📦 {String(restockReason)}
        </p>
      ) : null}
    </div>
  );
}

export default function InventoryChart({
  records,
  loading,
  depletionRate,
}: InventoryChartProps) {
  const { data: actualData, snapTimes } = useMemo(
    () => aggregateRecords(records),
    [records]
  );

  /* ═══ Build combined actual + prediction data ═════ */
  const { chartData, predictionStartIndex } = useMemo(() => {
    if (actualData.length === 0) return { chartData: [], predictionStartIndex: -1 };

    // Actual data occupies left 2/3 — predictions extend right 1/3
    // Number of prediction points = half the actual count (so pred = 1/3 of total)
    const numPred = Math.max(2, Math.floor(actualData.length / 2));
    const last = actualData[actualData.length - 1];

    // Compute average time gap between actual points for extrapolation labels
    let avgGapMs = 3_600_000; // default 1 hour
    if (actualData.length >= 2) {
      // Use the sorted sortKeys from aggregated data (not raw records which may be unsorted)
      const totalSpanMs = actualData[actualData.length - 1].sortKey - actualData[0].sortKey;
      if (totalSpanMs > 0 && actualData.length > 1) {
        avgGapMs = totalSpanMs / (actualData.length - 1);
      }
    }

    // Actual rows: prediction keys are null
    const actual = actualData.map((d) => ({
      ...d,
      predicted_stock: null as number | null,
      predicted_usage: null as number | null,
      isPrediction: false,
      slopeValue: null as number | null,
    }));

    // Bridge: last actual point also starts the prediction line
    actual[actual.length - 1] = {
      ...actual[actual.length - 1],
      predicted_stock: last.stock_level,
      predicted_usage: last.usage_rate_hourly,
    };

    const predStartIdx = actual.length - 1;

    // Generate prediction points — use the sorted last actual data point's epoch
    const predictions: typeof actual = [];
    const lastTimestamp = actualData[actualData.length - 1].sortKey;

    for (let i = 1; i <= numPred; i++) {
      const futureMs = lastTimestamp + avgGapMs * i;
      const futureDate = new Date(futureMs);
      const timeLabel = futureDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Stock prediction: last stock - depletionRate * hours elapsed
      const hoursElapsed = (avgGapMs * i) / 3_600_000;
      const stockPred =
        depletionRate != null
          ? Math.max(0, last.stock_level + depletionRate * hoursElapsed)
          : null;

      // Usage prediction: hold constant from last value (no usage slope in API)
      const usagePred = last.usage_rate_hourly;

      predictions.push({
        time: timeLabel,
        sortKey: futureMs,
        stock_level: null as unknown as number,
        usage_rate_hourly: null as unknown as number,
        hasSnap: false,
        hasRestock: false,
        restock_dot: null,
        restock_reason: null,
        predicted_stock: stockPred != null ? Math.round(stockPred * 100) / 100 : null,
        predicted_usage: Math.round(usagePred * 100) / 100,
        isPrediction: true,
        slopeValue: depletionRate,
      });
    }

    return {
      chartData: [...actual, ...predictions],
      predictionStartIndex: predStartIdx,
    };
  }, [actualData, depletionRate]);

  /* ═══ Calculate when stock reaches zero ════════════ */
  const depletionEta = useMemo(() => {
    if (depletionRate == null || depletionRate >= 0 || actualData.length === 0) return null;

    const last = actualData[actualData.length - 1];
    if (last.stock_level <= 0) return null;

    // hours until zero = stock / |depletionRate|
    const hoursToZero = last.stock_level / Math.abs(depletionRate);
    const lastTimestamp = last.sortKey;
    const zeroDate = new Date(lastTimestamp + hoursToZero * 3_600_000);

    return {
      date: zeroDate,
      hoursRemaining: hoursToZero,
      formatted: zeroDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [actualData, depletionRate]);

  /* ═══ Sequential fade-in animation ════════════════ */
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelRef.current || loading || chartData.length === 0) return;

    const panel = panelRef.current;
    const legendItems = panel.querySelectorAll(".shield-legend-item");
    const body = panel.querySelector(".shield-chart-body") as HTMLElement;
    const accentLine = panel.querySelector(".shield-chart-accent") as HTMLElement;

    const tl = gsap.timeline();

    // 1. Accent line sweeps from center
    if (accentLine) {
      tl.fromTo(accentLine, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, 0);
    }

    // 2. Panel slides and fades
    tl.fromTo(panel, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.1);

    // 3. Legend items stagger in one by one
    if (legendItems.length) {
      tl.fromTo(legendItems,
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.25, stagger: 0.08, ease: "power2.out" },
        0.4
      );
    }

    // 4. Chart body draws in
    if (body) {
      tl.fromTo(body,
        { opacity: 0, clipPath: "inset(0 100% 0 0)" },
        { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "power2.out" },
        0.65
      );
    }

    return () => { tl.kill(); };
  }, [loading, chartData]);

  if (loading) {
    return (
      <div className="shield-panel flex h-80 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--surface-3)] border-t-[var(--accent)]" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="shield-panel flex h-80 items-center justify-center">
        <p className="font-mono text-xs tracking-wider text-[var(--text-muted)]">NO DATA TO CHART</p>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="shield-panel relative flex h-full flex-col p-4 opacity-0">
      {/* Top accent line */}
      <div className="shield-chart-accent absolute inset-x-0 top-0 h-[2px] origin-center rounded-t bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ transform: "scaleX(0)" }} />

      {/* Legend header */}
      <div className="shield-chart-legend mb-4 flex flex-wrap items-center gap-5 font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
        <span className="shield-legend-item flex items-center gap-1.5 opacity-0">
          <span
            className="inline-block h-2.5 w-5 rounded-sm"
            style={{ background: STOCK_COLOR }}
          />
          Stock Level
        </span>
        <span className="shield-legend-item flex items-center gap-1.5 opacity-0">
          <span
            className="inline-block h-2.5 w-5 rounded-sm"
            style={{ background: USAGE_COLOR }}
          />
          Usage / hr
        </span>
        <span className="shield-legend-item flex items-center gap-1.5 opacity-0">
          <span
            className="inline-block h-0.5 w-5 border-t-2 border-dashed"
            style={{ borderColor: SNAP_COLOR }}
          />
          Snap Event
        </span>
        <span className="shield-legend-item flex items-center gap-1.5 opacity-0">
          <span
            className="inline-block h-2.5 w-5 rounded-sm opacity-30"
            style={{ background: RESTOCK_COLOR }}
          />
          Restock Event
        </span>
        {depletionRate != null && (
          <span className="shield-legend-item flex items-center gap-1.5 opacity-0">
            <span
              className="inline-block h-0.5 w-5 border-t-2 border-dashed"
              style={{ borderColor: PRED_STOCK_COLOR }}
            />
            Stock Prediction
          </span>
        )}
      </div>

      <div className="shield-chart-body min-h-0 flex-1 opacity-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 24, right: 12, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STOCK_COLOR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={STOCK_COLOR} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="predStockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRED_STOCK_COLOR} stopOpacity={0.1} />
              <stop offset="100%" stopColor={PRED_STOCK_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_COLOR}
            vertical={false}
          />

          <XAxis
            dataKey="time"
            tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: GRID_COLOR }}
            minTickGap={60}
            angle={-20}
            dy={8}
            height={50}
          />

          <YAxis
            yAxisId="stock"
            tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />

          <YAxis
            yAxisId="usage"
            orientation="right"
            tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />

          <Tooltip content={<ChartTooltip />} />



          {/* Snap event vertical line — first occurrence only */}
          {snapTimes.length > 0 && (
            <ReferenceLine
              key="snap-first"
              x={snapTimes[0]}
              yAxisId="stock"
              stroke={SNAP_COLOR}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              label={{
                value: "SNAP",
                position: "insideTopRight",
                fill: SNAP_COLOR,
                fontSize: 9,
                fontWeight: 600,
                offset: 6,
              }}
            />
          )}

          {/* Stock level — filled area + line */}
          <Area
            yAxisId="stock"
            type="monotone"
            dataKey="stock_level"
            stroke={STOCK_COLOR}
            strokeWidth={2}
            fill="url(#stockGrad)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: STOCK_COLOR, fill: "var(--surface-0)" }}
            isAnimationActive={true}
            animationDuration={1400}
            animationEasing="ease-out"
          />

          {/* Usage per hour — line only */}
          <Line
            yAxisId="usage"
            type="monotone"
            dataKey="usage_rate_hourly"
            stroke={USAGE_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: USAGE_COLOR, fill: "var(--surface-0)" }}
            isAnimationActive={true}
            animationDuration={1600}
            animationEasing="ease-out"
            animationBegin={200}
          />

          {/* Restock event dots — green circles on stock line */}
          <Line
            yAxisId="stock"
            type="monotone"
            dataKey="restock_dot"
            stroke="none"
            connectNulls={false}
            dot={(props: Record<string, unknown>) => {
              const cx = props.cx as number | undefined;
              const cy = props.cy as number | undefined;
              const value = props.value as number | null | undefined;
              if (value == null || cx == null || cy == null) return <></>;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={RESTOCK_COLOR}
                  stroke="var(--surface-0)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: RESTOCK_COLOR, fill: "var(--surface-0)" }}
            isAnimationActive={false}
            legendType="none"
          />

          {/* ═══ PREDICTION ZONE ════════════════════════ */}

          {/* Vertical divider line where predictions begin */}
          {predictionStartIndex >= 0 && chartData[predictionStartIndex] && (
            <ReferenceLine
              x={chartData[predictionStartIndex].time}
              yAxisId="stock"
              stroke={PRED_STOCK_COLOR}
              strokeDasharray="4 4"
              strokeWidth={1}
              strokeOpacity={0.5}
              label={{
                value: "FORECAST ▸",
                position: "insideTopRight",
                fill: PRED_STOCK_COLOR,
                fontSize: 8,
                fontWeight: 600,
                offset: 6,
              }}
            />
          )}

          {/* Predicted stock level — dashed line + faint fill */}
          {depletionRate != null && (
            <Area
              yAxisId="stock"
              type="monotone"
              dataKey="predicted_stock"
              stroke={PRED_STOCK_COLOR}
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="url(#predStockGrad)"
              dot={false}
              connectNulls
              activeDot={{ r: 4, strokeWidth: 2, stroke: PRED_STOCK_COLOR, fill: "var(--surface-0)" }}
              isAnimationActive={true}
              animationDuration={1000}
              animationBegin={1400}
              animationEasing="ease-out"
            />
          )}

          {/* Predicted usage — dashed line (held constant) */}
          <Line
            yAxisId="usage"
            type="monotone"
            dataKey="predicted_usage"
            stroke={PRED_USAGE_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
            activeDot={{ r: 4, strokeWidth: 2, stroke: PRED_USAGE_COLOR, fill: "var(--surface-0)" }}
            isAnimationActive={true}
            animationDuration={1000}
            animationBegin={1400}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {/* ═══ DEPLETION ETA BANNER ════════════════════ */}
      {depletionEta && (
        <div className="mt-4 flex items-center gap-3 rounded border border-red-900/30 bg-red-950/20 px-4 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs">⚠</span>
          <div className="font-mono text-xs tracking-wider">
            <span className="text-red-400 font-semibold">STOCK DEPLETION FORECAST:</span>{" "}
            <span className="text-[var(--text-primary)]">
              Projected to reach <span className="font-bold text-red-400">0</span> on{" "}
              <span className="font-semibold text-white">{depletionEta.formatted}</span>
            </span>
            <span className="ml-2 text-[var(--text-muted)]">
              ({depletionEta.hoursRemaining < 24
                ? `${depletionEta.hoursRemaining.toFixed(1)} hours`
                : `${(depletionEta.hoursRemaining / 24).toFixed(1)} days`} remaining)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
