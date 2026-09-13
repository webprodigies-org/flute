import { useState } from "react";
import { useDashboard } from "./data";

/** SOURCE OF TRUTH KEYWORDS: RevenueCard progress.
 * WHAT: opt-in chart reveal from explicit progress; ordinary host rendering is full.
 * WHY: the same provider-backed chart can participate in a scene without cloning.
 * WHERE: App.tsx supplies scene progress; DashboardProvider remains the data owner.
 */
export function RevenueCard({ progress = 1 }: { progress?: number }) {
  const reveal = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  const { data, period, setPeriod } = useDashboard();
  const [selected, setSelected] = useState<number | null>(null);
  const points = data?.points ?? [];
  const path = points
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"} ${(index * 360) / Math.max(1, points.length - 1)} ${130 - value}`,
    )
    .join(" ");
  return (
    <article className="card revenue-card" data-testid="revenue-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">REVENUE OVERVIEW</span>
          <h2>
            ${(data?.revenue ?? 0).toLocaleString()}
            <span className="growth">↗ {data?.growth ?? 0}%</span>
          </h2>
        </div>
        <select
          aria-label="Revenue period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option>This month</option>
          <option>Last month</option>
        </select>
      </div>
      <p className="card-subtitle">
        {selected === null
          ? "Your business, moving forward."
          : "Day " + (selected + 1) + " · " + points[selected] + " new orders"}
      </p>
      <div className="chart-wrap">
        <svg viewBox="0 0 360 150" role="img" aria-label="Revenue trend">
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#8c78ed" stopOpacity=".25" />
              <stop offset="1" stopColor="#8c78ed" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 65, 110].map((y) => (
            <line
              key={y}
              x1="0"
              x2="360"
              y1={y}
              y2={y}
              stroke="#efeff2"
              strokeDasharray="3 5"
            />
          ))}
          {points.map((value, index) => (
            <rect key={index} data-testid="revenue-bar"
              x={(index * 348) / Math.max(1, points.length - 1)}
              y={150 - value * reveal} width="10" height={value * reveal}
              rx="3" fill="#b79ade" fillOpacity=".3" />
          ))}
          <path d={path + " L 360 150 L 0 150 Z"} fill="url(#chart-fill)" />
          <path
            d={path}
            fill="none"
            stroke="#8974e9"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((value, i) => (
            <circle
              key={i}
              cx={(i * 360) / Math.max(1, points.length - 1)}
              cy={130 - value}
              r={selected === i ? 6 : 3}
              fill="#8974e9"
            />
          ))}
        </svg>
      </div>
      <div className="chart-axis">
        <span>SEP 01</span>
        <button
          onClick={() => setSelected(selected === null ? 6 : null)}
          aria-pressed={selected !== null}
        >
          Inspect trend ↗
        </button>
        <span>SEP 30</span>
      </div>
    </article>
  );
}
export function CustomersCard() {
  const { data, period } = useDashboard();
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="card customers-card" data-testid="customers-card">
      <div className="card-topline">
        <span className="metric-icon">◎</span>
        <span className="small-pill">+12.8%</span>
      </div>
      <p className="metric-label">Active customers</p>
      <h2>{(data?.customers ?? 0).toLocaleString()}</h2>
      <div className="metric-bottom">
        <div className="avatars">
          <i>AL</i>
          <i>MK</i>
          <i>JR</i>
          <i>+</i>
        </div>
        <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          View customers ↗
        </button>
      </div>
      {expanded && (
        <p className="customer-detail" role="status">
          Alex, Morgan and Jamie · {period}
        </p>
      )}
    </article>
  );
}
export function ActivityCard() {
  const { data } = useDashboard();
  return (
    <article className="card activity-card" data-testid="activity-card">
      <div className="activity-heading">
        <h3>Recent activity</h3>
        <span className="live-dot">Live</span>
      </div>
      {data?.activity.map((item, i) => (
        <div className="activity-row" key={item.name}>
          <span className={"activity-avatar avatar-" + i}>
            {item.name.slice(0, 1)}
          </span>
          <div>
            <strong>{item.name}</strong>
            <small>{item.detail}</small>
          </div>
          <b>{item.amount}</b>
        </div>
      ))}
    </article>
  );
}
