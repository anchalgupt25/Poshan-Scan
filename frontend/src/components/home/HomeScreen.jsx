import React, { useEffect, useState } from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import BotFab from '../shared/BotFab';
import { getScanHistory, scanBarcode } from '../../utils/api';
import './home.css';

const scanMethods = [
  {
    id: 'photo',
    primary: true,
    icon: '📷',
    title: 'Photograph the label',
    desc: 'Snap the back of the package — we read it instantly',
  },
  {
    id: 'barcode',
    icon: '🔢',
    title: 'Enter barcode',
    desc: 'Type the UPC manually — camera scan coming soon',
    badge: 'BETA',
  },
  {
    id: 'link',
    icon: '🔗',
    title: 'Paste a product link',
    desc: 'From Amazon, Walmart, Target, Instacart',
    badge: 'BETA',
  },
];

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function HomeScreen() {
  const navigate = useStore((s) => s.navigate);
  const activeKid = useStore((s) => s.getActiveKid());
  const localRecentScans = useStore((s) => s.recentScans);
  const hasMultipleKids = useStore((s) => s.hasMultipleKids);
  const setScanMethod = useStore((s) => s.setScanMethod);
  const setSelectedProduct = useStore((s) => s.setSelectedProduct);

  const [serverHistory, setServerHistory] = useState([]);

  useEffect(() => {
    const kidId = activeKid?.id;
    if (!kidId) { setServerHistory([]); return; }
    let cancelled = false;
    getScanHistory(kidId, 5)
      .then((rows) => {
        if (cancelled) return;
        const normalized = (rows || [])
          .filter((r) => r.score_result && Object.keys(r.score_result).length)
          .map((r) => ({
            historyId: r.id,
            barcode: r.barcode,
            scannedAt: r.scanned_at,
            product: {
              name: r.score_result?.product_name || `Scan #${r.id}`,
              brand: r.score_result?.brand || '',
              barcode: r.barcode,
            },
            score: r.score_result,
          }));
        setServerHistory(normalized);
      })
      .catch((e) => console.warn('[home] scan history fetch failed:', e?.message));
    return () => { cancelled = true; };
  }, [activeKid?.id]);

  const recentScans = [
    ...serverHistory,
    ...localRecentScans.filter((local) => {
      const lid = local?.product?.barcode || local?.product?.name;
      return !serverHistory.some((s) => (s?.product?.barcode || s?.product?.name) === lid);
    }),
  ].slice(0, 5);

  const handleScanClick = (methodId) => {
    setScanMethod(methodId);
    navigate('scanning');
  };

  const handleRecentClick = async (scan) => {
    if (scan.barcode) {
      try {
        const fresh = await scanBarcode(scan.barcode, activeKid?.id);
        if (fresh?.product) {
          setSelectedProduct(fresh);
          navigate('result');
          return;
        }
      } catch (_) {}
    }
    setSelectedProduct(scan);
    navigate('result');
  };

  // Thumb color based on score grade
  const thumbClass = (score) => {
    const g = score?.grade;
    if (g === 'A' || g === 'B') return 'safe';
    if (g === 'C' || g === 'D') return 'flag';
    return '';
  };

  // Status text for recent rows
  const recentStatus = (scan) => {
    const g = scan.score?.grade;
    const flags = scan.score?.flags || [];
    const red = flags.find((f) => (f.severity || '').toLowerCase() === 'red');
    if (red) return red.title || 'Flagged';
    if (g === 'A') return 'Good choice';
    if (g === 'B') return 'Fine occasionally';
    if (g === 'C') return 'Use with caution';
    if (g === 'D') return 'Consider skipping';
    return 'Scanned';
  };

  const childName = activeKid?.name || 'your little one';

  return (
    <div className="screen home-screen animate-fade-in">
      <StatusBar />

      <div className="home-header">
        <div className="home-greeting-block">
          <div className="home-greeting-label">{timeOfDayGreeting()}</div>
          <div className="home-greeting-title">
            What are we checking for <em>{childName}</em>?
          </div>
          {hasMultipleKids && (
            <button className="switch-kid-btn" onClick={() => navigate('kidSelector')}>
              ↻ Switch kiddo
            </button>
          )}
        </div>
        <div
          className={`avatar ${activeKid?.colorClass || 'color-1'}`}
          onClick={() => navigate('profile')}
        >
          {activeKid?.initial || '?'}
        </div>
      </div>

      <div className="scrollable">
        <div className="home-section-label">Quick check</div>
        <div className="scan-cards">
          {scanMethods.map((m) => (
            <div
              key={m.id}
              className={`scan-card ${m.primary ? 'primary' : ''}`}
              onClick={() => handleScanClick(m.id)}
            >
              <div className="scan-card-icon">{m.icon}</div>
              <div className="scan-card-info">
                <div className="scan-card-title">
                  {m.title}
                  {m.badge && <span className="scan-card-badge">{m.badge}</span>}
                </div>
                <div className="scan-card-desc">{m.desc}</div>
              </div>
              <div className="scan-card-arrow">→</div>
            </div>
          ))}
        </div>

        {recentScans.length > 0 ? (
          <div className="recent-section">
            <div className="recent-header">
              <div className="recent-title">Recent scans</div>
            </div>
            <div className="recent-list">
              {recentScans.map((s, i) => {
                const p = s?.product || {};
                return (
                  <div key={i} className="recent-item" onClick={() => handleRecentClick(s)}>
                    <div className={`recent-thumb ${thumbClass(s.score)}`}>
                      {s.score?.grade === 'A' || s.score?.grade === 'B' ? '✓' : s.score?.grade === 'C' || s.score?.grade === 'D' ? '!' : '📦'}
                    </div>
                    <div className="recent-info">
                      <div className="recent-name">{p.name || 'Product'}</div>
                      <div className="recent-status">{recentStatus(s)}</div>
                    </div>
                    <div className="recent-time">{timeAgo(s.scannedAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="recent-section">
            <div className="recent-title" style={{ marginBottom: 14 }}>Quick tips</div>
            <div className="tip-card">
              <div className="tip-emoji">💡</div>
              <div className="tip-text">
                <strong>Start your first scan.</strong>
                <br />
                Tap any option above to check a snack for {childName}.
              </div>
            </div>
          </div>
        )}
      </div>

      <BotFab variant="home" />
    </div>
  );
}
