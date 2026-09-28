"use client";

import { useEffect, useMemo, useState } from "react";

const presets = [
  ["thisWeek", "Ši savaitė"],
  ["previousWeek", "Praėjusi savaitė"],
  ["7d", "7 d."],
  ["30d", "30 d."],
  ["custom", "Pasirinkti"]
];

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

function rangeForPreset(preset) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (preset === "thisWeek") {
    return { from: iso(startOfWeek(today)), to: iso(today) };
  }

  if (preset === "previousWeek") {
    const thisMonday = startOfWeek(today);
    const from = new Date(thisMonday);
    from.setDate(from.getDate() - 7);
    const to = new Date(thisMonday);
    to.setDate(to.getDate() - 1);
    return { from: iso(from), to: iso(to) };
  }

  const days = preset === "30d" ? 29 : 6;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { from: iso(from), to: iso(today) };
}

function pct(value, total) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function prettyName(name) {
  if (!name) return "Nežinoma forma";
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const initial = rangeForPreset("previousWeek");
  const [preset, setPreset] = useState("previousWeek");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [formId, setFormId] = useState("all");
  const [data, setData] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function applyPreset(value) {
    setPreset(value);
    if (value !== "custom") {
      const next = rangeForPreset(value);
      setFrom(next.from);
      setTo(next.to);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/submissions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: "no-store" }
        );
        const json = await response.json();

        if (!response.ok || !json.success) {
          throw new Error(json.message || "Nepavyko gauti duomenų.");
        }

        if (!cancelled) {
          setData(Array.isArray(json.data) ? json.data : []);
          setApiSummary(json.summary || null);
        }
      } catch (e) {
        if (!cancelled) {
          setData([]);
          setApiSummary(null);
          setError(e.message || "Nepavyko gauti duomenų.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (from && to) load();
    return () => { cancelled = true; };
  }, [from, to]);

  const forms = useMemo(() => {
    const map = new Map();
    data.forEach((row) => {
      map.set(String(row.form_id), row.form_name || `Form #${row.form_id}`);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "lt"));
  }, [data]);

  const rows = useMemo(() => {
    if (formId === "all") return data;
    return data.filter((row) => String(row.form_id) === formId);
  }, [data, formId]);

  const summary = useMemo(() => {
    const total = rows.length;
    let fbclid = 0;
    let utm = 0;
    let both = 0;
    let noTracking = 0;

    rows.forEach((row) => {
      const hasFb = Boolean(row.has_fbclid || row.fbclid);
      const hasUtm = Boolean(
        row.has_utm ||
        row.utm_source ||
        row.utm_medium ||
        row.utm_campaign ||
        row.utm_adset ||
        row.utm_content ||
        row.utm_term
      );

      if (hasFb) fbclid += 1;
      if (hasUtm) utm += 1;
      if (hasFb && hasUtm) both += 1;
      if (!hasFb && !hasUtm) noTracking += 1;
    });

    return { total, fbclid, utm, both, noTracking };
  }, [rows]);

  const formBreakdown = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = String(row.form_id);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: row.form_name || `Form #${row.form_id}`,
          total: 0,
          fbclid: 0,
          utm: 0,
          both: 0
        });
      }

      const item = map.get(key);
      const hasFb = Boolean(row.has_fbclid || row.fbclid);
      const hasUtm = Boolean(
        row.has_utm ||
        row.utm_source ||
        row.utm_medium ||
        row.utm_campaign ||
        row.utm_adset ||
        row.utm_content ||
        row.utm_term
      );

      item.total += 1;
      if (hasFb) item.fbclid += 1;
      if (hasUtm) item.utm += 1;
      if (hasFb && hasUtm) item.both += 1;
    });

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const campaigns = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const campaign = (row.utm_campaign || "").trim();
      if (!campaign) return;
      const adset = (row.utm_adset || "").trim();
      const key = `${campaign}__${adset}`;
      const current = map.get(key) || {
        campaign,
        adset: adset || "—",
        leads: 0,
        fbclid: 0
      };
      current.leads += 1;
      if (row.has_fbclid || row.fbclid) current.fbclid += 1;
      map.set(key, current);
    });

    return [...map.values()]
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 30);
  }, [rows]);

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">FINHAUS</div>
          <h1>Lead Dashboard</h1>
          <p className="subtitle">Realūs Forminator užpildymai iš svetainės</p>
        </div>
        <div className="live-pill">
          <span className="dot" />
          Live iš WordPress
        </div>
      </header>

      <section className="filters card">
        <div className="preset-group">
          {presets.map(([value, label]) => (
            <button
              key={value}
              className={preset === value ? "active" : ""}
              onClick={() => applyPreset(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <label>
            Nuo
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
            />
          </label>

          <label>
            Iki
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
            />
          </label>

          <label className="form-filter">
            Forma
            <select value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="all">Visos formos</option>
              {forms.map(([id, name]) => (
                <option key={id} value={id}>{prettyName(name)}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="metrics">
        <Metric title="Visi užpildymai" value={summary.total} hint={loading ? "Kraunama…" : `${from} – ${to}`} />
        <Metric title="Su FBCLID" value={summary.fbclid} hint={pct(summary.fbclid, summary.total)} />
        <Metric title="Su UTM" value={summary.utm} hint={pct(summary.utm, summary.total)} />
        <Metric title="FBCLID + UTM" value={summary.both} hint={pct(summary.both, summary.total)} />
        <Metric title="Be tracking" value={summary.noTracking} hint={pct(summary.noTracking, summary.total)} danger={summary.noTracking > 0} />
      </section>

      <section className="grid-2">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2>Užpildymai pagal formas</h2>
              <p>Kiek realių submission’ų gavo kiekviena forma</p>
            </div>
            <span className="count">{formBreakdown.length} formų</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Užpildymai</th>
                  <th>FBCLID</th>
                  <th>UTM</th>
                  <th>FBCLID + UTM</th>
                </tr>
              </thead>
              <tbody>
                {formBreakdown.map((item) => (
                  <tr key={item.id}>
                    <td className="name-cell">{prettyName(item.name)}</td>
                    <td>{item.total}</td>
                    <td>{item.fbclid} <small>{pct(item.fbclid, item.total)}</small></td>
                    <td>{item.utm} <small>{pct(item.utm, item.total)}</small></td>
                    <td>{item.both} <small>{pct(item.both, item.total)}</small></td>
                  </tr>
                ))}
                {!loading && formBreakdown.length === 0 && (
                  <tr><td colSpan="5" className="empty">Pasirinktu laikotarpiu užpildymų nėra.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2>Tracking kokybė</h2>
              <p>Greitas vaizdas, kiek užpildymų turi reklamos žymes</p>
            </div>
          </div>

          <div className="quality-list">
            <Progress label="FBCLID" value={summary.fbclid} total={summary.total} />
            <Progress label="UTM" value={summary.utm} total={summary.total} />
            <Progress label="FBCLID + UTM" value={summary.both} total={summary.total} />
            <Progress label="Be tracking" value={summary.noTracking} total={summary.total} inverse />
          </div>

          {apiSummary && formId === "all" && (
            <div className="api-note">
              WP API: {apiSummary.total_submissions ?? summary.total} užpildymų šiame laikotarpyje.
            </div>
          )}
        </div>
      </section>

      <section className="card panel campaign-panel">
        <div className="panel-head">
          <div>
            <h2>UTM kampanijos ir ad set’ai</h2>
            <p>Tik tie užpildymai, kuriuose yra UTM campaign</p>
          </div>
          <span className="count">{campaigns.length} eilučių</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>UTM campaign</th>
                <th>UTM adset</th>
                <th>Užpildymai</th>
                <th>Su FBCLID</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((item, index) => (
                <tr key={`${item.campaign}-${item.adset}-${index}`}>
                  <td className="name-cell">{item.campaign}</td>
                  <td>{item.adset}</td>
                  <td>{item.leads}</td>
                  <td>{item.fbclid} <small>{pct(item.fbclid, item.leads)}</small></td>
                </tr>
              ))}
              {!loading && campaigns.length === 0 && (
                <tr><td colSpan="4" className="empty">Šiame pjūvyje UTM kampanijų nėra.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        Duomenys skaitomi tiesiai iš Finhaus WordPress / Forminator. Kontaktiniai duomenys dashboard’e nenaudojami.
      </footer>
    </main>
  );
}

function Metric({ title, value, hint, danger }) {
  return (
    <div className={`metric card ${danger ? "metric-danger" : ""}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Progress({ label, value, total, inverse }) {
  const percentage = total ? (value / total) * 100 : 0;
  return (
    <div className="progress-row">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{value} <small>{pct(value, total)}</small></strong>
      </div>
      <div className="track">
        <div
          className={inverse ? "fill inverse" : "fill"}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}
