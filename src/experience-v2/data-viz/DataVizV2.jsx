import { useMemo, useState } from "react";
import { Button, TableShell } from "../components";

const SERIES_COLORS = [
  "var(--ev2-action)",
  "var(--ev2-identity)",
  "var(--ev2-warning)",
  "var(--ev2-text-secondary)",
  "var(--ev2-success)",
];

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return (Math.round(numeric * 100) / 100).toLocaleString("en-GH");
}

function markLabel(row, series) {
  return `${row.label} · ${series.label}: ${formatNumber(row[series.key])}`;
}

function markInteraction(row, series, onOpen) {
  const label = markLabel(row, series);
  if (!onOpen) return { tabIndex: 0, role: "img", "aria-label": label };
  return {
    tabIndex: 0,
    role: "button",
    "aria-label": `Open ${label}`,
    onClick: () => onOpen(row, series),
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(row, series);
      }
    },
  };
}

function showAxisLabel(index, length) {
  if (length <= 10) return true;
  if (index === 0 || index === length - 1) return true;
  const every = Math.max(2, Math.ceil(length / 8));
  return index % every === 0;
}

function ChartAxis({ width, height, pad, max, ticks = 4 }) {
  const rows = [];
  for (let index = 0; index <= ticks; index += 1) {
    const y = pad.top + (height - pad.top - pad.bottom) * (index / ticks);
    rows.push(
      <g key={index} aria-hidden="true">
        <line className="ev2dv-grid-line" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
        <text className="ev2dv-axis-label" x={pad.left - 8} y={y + 4} textAnchor="end">
          {formatNumber(max * (1 - index / ticks))}
        </text>
      </g>,
    );
  }
  return <g>{rows}</g>;
}

function LineChart({ data, series, width, height, pad, max, onOpen }) {
  const step = (width - pad.left - pad.right) / Math.max(1, data.length - 1);

  return (
    <g>
      {series.map((item, seriesIndex) => {
        const points = data.map((row, index) => {
          const value = Number(row[item.key]) || 0;
          const x = pad.left + step * index;
          const y = height - pad.bottom - ((height - pad.top - pad.bottom) * value) / max;
          return { x, y, value, row };
        });
        return (
          <g key={item.key}>
            <polyline
              className="ev2dv-line"
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              style={{ stroke: SERIES_COLORS[seriesIndex % SERIES_COLORS.length] }}
              aria-hidden="true"
            />
            {points.map((point) => (
              <g
                className={`ev2dv-mark ${onOpen ? "is-actionable" : ""}`.trim()}
                key={`${item.key}-${point.row.label}`}
                {...markInteraction(point.row, item, onOpen)}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  style={{ fill: SERIES_COLORS[seriesIndex % SERIES_COLORS.length] }}
                />
                <title>{markLabel(point.row, item)}</title>
              </g>
            ))}
          </g>
        );
      })}
      {data.map((row, index) => showAxisLabel(index, data.length) ? (
        <text
          aria-hidden="true"
          className="ev2dv-axis-label"
          key={row.label}
          x={pad.left + step * index}
          y={height - 7}
          textAnchor="middle"
        >
          {row.label}
        </text>
      ) : null)}
    </g>
  );
}

function BarChart({ data, series, width, height, pad, max, paired, onOpen }) {
  const band = (width - pad.left - pad.right) / Math.max(1, data.length);
  const visibleSeries = paired ? series : series.slice(0, 1);
  const count = Math.max(1, visibleSeries.length);
  const barWidth = Math.max(5, Math.min(22, (band - 12) / count));

  return (
    <g>
      {data.map((row, rowIndex) => {
        const start = pad.left + band * rowIndex + (band - barWidth * count - (count - 1) * 4) / 2;
        return (
          <g key={row.label}>
            {visibleSeries.map((item, seriesIndex) => {
              const value = Number(row[item.key]) || 0;
              const barHeight = ((height - pad.top - pad.bottom) * value) / max;
              const x = start + seriesIndex * (barWidth + 4);
              const y = height - pad.bottom - barHeight;
              return (
                <g
                  className={`ev2dv-mark ${onOpen ? "is-actionable" : ""}`.trim()}
                  key={item.key}
                  {...markInteraction(row, item, onOpen)}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(0, barHeight)}
                    rx="4"
                    style={{ fill: SERIES_COLORS[seriesIndex % SERIES_COLORS.length] }}
                  />
                  <title>{markLabel(row, item)}</title>
                </g>
              );
            })}
            {showAxisLabel(rowIndex, data.length) ? <text
              aria-hidden="true"
              className="ev2dv-axis-label"
              x={pad.left + band * rowIndex + band / 2}
              y={height - 7}
              textAnchor="middle"
            >
              {row.label}
            </text> : null}
          </g>
        );
      })}
    </g>
  );
}

function DonutChart({ data, series, onOpen, size = 190 }) {
  const item = series[0];
  if (!item) return null;
  const total = data.reduce((sum, row) => sum + (Number(row[item.key]) || 0), 0) || 1;
  const center = size / 2;
  const radius = size / 2 - 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg className="ev2dv-donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={item.label}>
      {data.slice(0, 5).map((row, index) => {
        const value = Number(row[item.key]) || 0;
        const length = (value / total) * circumference;
        const dashOffset = offset;
        offset += length;
        return (
          <g
            className={`ev2dv-mark ${onOpen ? "is-actionable" : ""}`.trim()}
            key={row.label}
            {...markInteraction(row, item, onOpen)}
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth="22"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-dashOffset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ stroke: SERIES_COLORS[index % SERIES_COLORS.length] }}
            />
            <title>{markLabel(row, item)}</title>
          </g>
        );
      })}
      <text className="ev2dv-donut-total" x={center} y={center - 2} textAnchor="middle">{formatNumber(total)}</text>
      <text className="ev2dv-donut-caption" x={center} y={center + 18} textAnchor="middle">recorded total</text>
    </svg>
  );
}

export function DataVizChart({
  kind = "bar",
  data = [],
  series = [],
  title,
  note,
  summary,
  ariaLabel,
  defaultView = "chart",
  compact = false,
  className = "",
  onOpen,
}) {
  const [view, setView] = useState(defaultView === "table" ? "table" : "chart");
  // Whole-number measures must never show fractional tick labels.
  // Decimal measures keep their original precision.
  const values = data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
  const observedMax = Math.max(...values, 0);
  const isCount = values.every((value) => Number.isInteger(value) && value >= 0);
  const max = isCount
    ? observedMax <= 4 ? Math.max(1, observedMax) : Math.ceil(observedMax / 4) * 4
    : Math.max(observedMax, 1);
  const columns = useMemo(() => [
    {
      key: "label",
      label: "Record",
      render: (row) => onOpen
        ? <button type="button" className="ev2dv-record-button" onClick={() => onOpen(row, null)}>{row.label}</button>
        : row.label,
    },
    ...series.map((item) => ({
      key: item.key,
      label: item.label,
      align: "right",
      render: (row) => formatNumber(row[item.key]),
    })),
  ], [series, onOpen]);

  if (!data.length || !series.length) return null;

  const width = 640;
  const height = compact ? 150 : 230;
  const pad = compact
    ? { top: 12, right: 12, bottom: 28, left: 44 }
    : { top: 16, right: 16, bottom: 32, left: 48 };

  return (
    <figure className={`ev2dv-chart ${compact ? "is-compact" : ""} ${className}`.trim()}>
      <figcaption className="ev2dv-chart-head">
        <div className="ev2dv-chart-copy">
          {title ? <strong>{title}</strong> : null}
          {note ? <span>{note}</span> : null}
        </div>
        <div className="ev2dv-chart-actions">
          {summary ? <strong className="ev2dv-summary">{summary}</strong> : null}
          <Button
            variant="quiet"
            size="compact"
            icon={view === "chart" ? "table" : "chart"}
            onClick={() => setView((current) => current === "chart" ? "table" : "chart")}
            aria-label={view === "chart" ? `Show ${title || "chart"} as table` : `Show ${title || "data"} as chart`}
          >
            {view === "chart" ? "Table" : "Chart"}
          </Button>
        </div>
      </figcaption>

      {series.length > 1 ? (
        <div className="ev2dv-legend" aria-label="Chart legend">
          {series.map((item, index) => (
            <span key={item.key}>
              <i style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}

      {view === "table" ? (
        <TableShell caption={title ? `${title} — recorded values` : "Recorded values"} columns={columns} rows={data} />
      ) : kind === "donut" ? (
        <div className="ev2dv-donut-wrap"><DonutChart data={data} series={series} onOpen={onOpen} /></div>
      ) : kind === "bar" && data.length === 1 && series.length === 1 ? (
        <div className="ev2dv-single-fact">
          <strong>{formatNumber(data[0][series[0].key])}</strong>
          <span>{data[0].label} · {series[0].label}</span>
          {onOpen ? <button type="button" className="ev2dv-record-button" onClick={() => onOpen(data[0], series[0])}>View records</button> : null}
        </div>
      ) : (
        <div className="ev2dv-svg-wrap">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label={ariaLabel || title || "Recorded data chart"}
          >
            <ChartAxis width={width} height={height} pad={pad} max={max} ticks={isCount && max <= 4 ? max : 4} />
            {kind === "line" ? (
              <LineChart data={data} series={series} width={width} height={height} pad={pad} max={max} onOpen={onOpen} />
            ) : (
              <BarChart
                data={data}
                series={series}
                width={width}
                height={height}
                pad={pad}
                max={max}
                paired={kind === "pairedBar"}
                onOpen={onOpen}
              />
            )}
          </svg>
        </div>
      )}
    </figure>
  );
}

export default DataVizChart;
