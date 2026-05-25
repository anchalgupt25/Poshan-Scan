import React, { useEffect, useState } from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import BotFab from '../shared/BotFab';
import { getScanHistory, scanBarcode } from '../../utils/api';
import './home.css';

const scanMethods = [
  { id: 'barcode', emoji: '🔢', title: 'Enter Barcode',  desc: 'Type the UPC from any package' },
  { id: 'photo',   emoji: '📷', title: 'Scan Label',     desc: 'Use camera to read the nutrition label' },
  { id: 'link',    emoji: '🔗', title: 'Paste Link',     desc: 'Amazon, Walmart, Target, Instacart URLs' },
];

export default function HomeScreen() {
  const navigate = useStore((s) => s.navigate);
  const activeKid = useStore((s) => s.getActiveKid());
  const localRecentScans = useStore((s) => s.recentScans);
  const hasMultipleKids = useStore((s) => s.hasMultipleKids);
  const setScanMethod = useStore((s) => s.setScanMethod);
  const setSelectedProduct = useStore((s) => s.setSelectedProduct);

  // Server-side scan history for the active kid, fetched on mount and on kid
  // switch. Falls back to the locally-tracked recentScans when the server is
  // unreachable. This is what makes "last 5 scans" survive logout/login.
  const [serverHistory, setServerHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const kidId = activeKid?.id;
    if (!kidId) {
      setServerHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    getScanHistory(kidId, 5)
      .then((rows) => {
        if (cancelled) return;
        // Backend returns: [{ id, barcode, scan_type, score_result, scanned_at }]
        // Normalize to the shape ResultScreen expects ({ product, score }).
        const normalized = (rows || [])
          .filter((r) => r.score_result && Object.keys(r.score_result).length)
          .map((r) => ({
            historyId: r.id,
            barcode: r.barcode,
            product: {
              name: r.score_result?.product_name || `Scan #${r.id}`,
              brand: r.score_result?.brand || '',
              barcode: r.barcode,
            },
            score: r.score_result,
            scannedAt: r.scanned_at,
          }));
        setServerHistory(normalized);
      })
      .catch((e) => {
        console.warn('[home] scan history fetch failed:', e?.message);
      })
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => { cancelled = true; };
  }, [activeKid?.id]);

  // Merge: server history first (canonical), then any local-only scans
  // (e.g. a scan that just happened and hasn't been written to the server yet)
  const recentScans = [...serverHistory, ...localRecentScans.filter((local) => {
    const lid = local?.product?.barcode || local?.product?.name;
    return !serverHistory.some((s) => (s?.product?.barcode || s?.product?.name) === lid);
  })].slice(0, 5);

  const handleScanClick = (methodId) => {
    setScanMethod(methodId);
    navigate('scanning');
  };

  // When the user taps a history row, re-fetch the fresh score by barcode if
  // we have one (so the score reflects the current child profile). If no
  // barcode (e.g. an OCR scan), fall back to the stored snapshot.
  const handleRecentClick = async (scan) => {
    if (scan.barcode) {
      try {
        const fresh = await scanBarcode(scan.barcode, activeKid?.id);
        if (fresh?.product) {
          setSelectedProduct(fresh);
          navigate('result');
          return;
        }
      } catch (_) {
        // fall through to using the stored snapshot
      }
    }
    setSelectedProduct(scan);
    navigate('result');
  };

  return (
    <div className="screen animate-fade-in">
      <StatusBar />
      <div className="scrollable" style={{ padding: '0 24px 100px' }}>
        <div className="home-greeting">
          <div>
            <div className="home-hello">Hello! 👋</div>
            <div className="home-child-name">
              Scanning for <strong style={{ marginLeft: 4 }}>{activeKid?.name || 'your child'}</strong>
              {hasMultipleKids && (
                <button className="btn-text" onClick={() => navigate('kidSelector')} style={{ marginLeft: 8, fontSize: 13 }}>
                  Switch
                </button>
              )}
            </div>
          </div>
          <div
            className={`avatar ${activeKid?.colorClass || 'color-1'}`}
            onClick={() => navigate('profile')}
          >
            {activeKid?.initial || '?'}
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>SCAN A PRODUCT</div>
        <div className="scan-cards">
          {scanMethods.map((m) => (
            <div key={m.id} className="scan-card" onClick={() => handleScanClick(m.id)}>
              <div className="scan-card-emoji">{m.emoji}</div>
              <div className="scan-card-info">
                <div className="scan-card-title">{m.title}</div>
                <div className="scan-card-desc">{m.desc}</div>
              </div>
              <div className="scan-card-arrow">→</div>
            </div>
          ))}
        </div>

        {recentScans.length > 0 ? (
          <>
            <div className="section-label" style={{ marginTop: 28 }}>RECENT SCANS</div>
            {recentScans.map((s, i) => {
              const p = s?.product || {};
              return (
                <div key={i} className="recent-item" onClick={() => handleRecentClick(s)}>
                  <div className="recent-thumb">📦</div>
                  <div className="recent-info">
                    <div className="recent-name">{p.name || 'Product'}</div>
                    <div className="recent-brand">{p.brand || (p.barcode ? 'UPC ' + p.barcode : '—')}</div>
                  </div>
                  <div style={{ fontSize: 18, color: 'var(--ink-muted)' }}>→</div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div className="section-label" style={{ marginTop: 28 }}>QUICK TIPS</div>
            <div className="tip-card">
              <div className="tip-emoji">💡</div>
              <div className="tip-text">
                <strong>Start your first scan!</strong>
                <br />
                Tap any scan method above to check a product for {activeKid?.name || 'your child'}.
              </div>
            </div>
          </>
        )}
      </div>
      <BotFab />
    </div>
  );
}
