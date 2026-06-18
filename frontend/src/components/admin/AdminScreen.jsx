import React, { useEffect, useState } from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import {
  adminStats,
  adminUsers,
  adminSignupsByDay,
  adminScansByDay,
  adminTopProducts,
} from '../../utils/api';
import './admin.css';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function timeAgo(iso) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  if (isNaN(ms)) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Stat({ label, value, sub }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
      {sub != null && <div className="admin-stat-sub">{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data, valueKey, labelKey, maxBars = 14 }) {
  // data: [{day: 'YYYY-MM-DD', <valueKey>: n}], most-recent first
  if (!data || data.length === 0) {
    return <div className="admin-empty">No data yet.</div>;
  }
  const slice = data.slice(0, maxBars).reverse();
  const max = Math.max(...slice.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="admin-bars">
      {slice.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const pct = (v / max) * 100;
        return (
          <div key={i} className="admin-bar-col" title={`${d[labelKey]}: ${v}`}>
            <div className="admin-bar-track">
              <div className="admin-bar-fill" style={{ height: `${pct}%` }} />
            </div>
            <div className="admin-bar-count">{v}</div>
            <div className="admin-bar-label">{(d[labelKey] || '').slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminScreen() {
  const navigate = useStore((s) => s.navigate);
  const authEmail = useStore((s) => s.authEmail);
  const isAdmin = useStore((s) => s.isAdmin);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [signups, setSignups] = useState([]);
  const [scans, setScans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      adminStats().catch((e) => { throw e; }),
      adminUsers(100).catch(() => []),
      adminSignupsByDay().catch(() => []),
      adminScansByDay().catch(() => []),
      adminTopProducts(15).catch(() => []),
    ]).then(([s, u, sd, scd, p]) => {
      if (cancelled) return;
      setStats(s);
      setUsers(u || []);
      setSignups(sd || []);
      setScans(scd || []);
      setProducts(p || []);
    }).catch((e) => {
      if (!cancelled) setError(e.message || 'Failed to load admin data.');
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="screen animate-fade-in">
        <StatusBar />
        <div className="nav-header">
          <button className="nav-back" onClick={() => navigate('home')}>←</button>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Not authorized</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)' }}>
          You're signed in as <strong>{authEmail || '—'}</strong>, which doesn't have admin access.
        </div>
      </div>
    );
  }

  return (
    <div className="screen admin-screen animate-fade-in">
      <StatusBar />
      <div className="nav-header">
        <button className="nav-back" onClick={() => navigate('profile')}>←</button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Admin</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="scrollable" style={{ padding: '0 16px 80px' }}>
        <div className="admin-greeting">
          <div className="admin-greeting-label">Beta dashboard</div>
          <div className="admin-greeting-title">How is <em>Nouri Scan</em> doing?</div>
          <div className="admin-greeting-sub">Live data from Turso · refreshed on view</div>
        </div>

        {error && <div className="admin-error">⚠️ {error}</div>}

        {loading ? (
          <div className="admin-empty">Loading…</div>
        ) : !stats ? (
          <div className="admin-empty">No data yet.</div>
        ) : (
          <>
            {/* Headline numbers */}
            <div className="admin-section-label">Signups</div>
            <div className="admin-stat-grid">
              <Stat label="Total signups" value={stats.users.total_signups} />
              <Stat
                label="Returned at least once"
                value={stats.users.returned_at_least_once}
                sub={`${Math.round((stats.users.returned_at_least_once / Math.max(1, stats.users.total_signups)) * 100)}% return rate`}
              />
              <Stat label="Last 7 days" value={stats.users.signups_last_7d} />
              <Stat label="Child profiles" value={stats.kids.total_profiles} />
            </div>

            <div className="admin-section-label">Scans</div>
            <div className="admin-stat-grid">
              <Stat label="Total scans" value={stats.scans.total} />
              <Stat label="Last 24 hours" value={stats.scans.last_24h} />
              <Stat label="Last 7 days" value={stats.scans.last_7d} />
              <Stat label="Unique products" value={stats.scans.unique_products} />
              <Stat label="Image uploads" value={stats.scans.image_uploads} sub="OCR via Claude Vision" />
            </div>

            {/* Signup trend */}
            <div className="admin-section-label">Signups per day</div>
            <div className="admin-card">
              <MiniBarChart data={signups} valueKey="signups" labelKey="day" />
            </div>

            {/* Scan trend */}
            <div className="admin-section-label">Scans per day</div>
            <div className="admin-card">
              <MiniBarChart data={scans} valueKey="scans" labelKey="day" />
            </div>

            {/* User list */}
            <div className="admin-section-label">All users · {users.length}</div>
            <div className="admin-table">
              <div className="admin-table-row admin-table-head">
                <div className="col-email">Email</div>
                <div className="col-num">Kids</div>
                <div className="col-num">Scans</div>
                <div className="col-num">Unique</div>
                <div className="col-num">Photos</div>
                <div className="col-time">Last seen</div>
              </div>
              {users.map((u) => (
                <div key={u.id} className="admin-table-row">
                  <div className="col-email">
                    <div className="admin-user-email">{u.email}</div>
                    <div className="admin-user-meta">
                      Signed up {fmtDate(u.created_at)} · code {u.invite_code || '—'}
                    </div>
                  </div>
                  <div className="col-num">{u.kids}</div>
                  <div className="col-num">{u.total_scans}</div>
                  <div className="col-num">{u.unique_scans}</div>
                  <div className="col-num">{u.image_uploads}</div>
                  <div className="col-time">{timeAgo(u.last_login_at || u.created_at)}</div>
                </div>
              ))}
            </div>

            {/* Top products */}
            <div className="admin-section-label">Most-scanned products</div>
            <div className="admin-card">
              {products.length === 0 ? (
                <div className="admin-empty">No scans yet.</div>
              ) : (
                <div className="admin-product-list">
                  {products.map((p, i) => (
                    <div key={i} className="admin-product-row">
                      <div className="admin-product-rank">{i + 1}</div>
                      <div className="admin-product-info">
                        <div className="admin-product-name">{p.product}</div>
                        {p.brand && <div className="admin-product-brand">{p.brand}</div>}
                      </div>
                      <div className="admin-product-count">{p.times_scanned}×</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
