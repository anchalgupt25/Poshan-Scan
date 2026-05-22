import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';

export default function KidSelector() {
  const navigate = useStore((s) => s.navigate);
  const kids = useStore((s) => s.kids);
  const setActiveKid = useStore((s) => s.setActiveKid);

  return (
    <div className="screen animate-fade-in">
      <StatusBar />
      <div className="nav-header">
        <button className="nav-back" onClick={() => navigate('home')}>←</button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Switch Kid</div>
        <div style={{ width: 40 }} />
      </div>
      <div className="scrollable" style={{ padding: '8px 24px 24px' }}>
        <div className="section-label">WHO ARE WE SCANNING FOR?</div>
        {kids.map((k) => (
          <div
            key={k.id}
            className="recent-item"
            onClick={() => { setActiveKid(k.id); navigate('home'); }}
          >
            <div className={`avatar ${k.colorClass}`} style={{ width: 44, height: 44 }}>{k.initial}</div>
            <div className="recent-info">
              <div className="recent-name">{k.name}</div>
              <div className="recent-brand">{k.age_band} · {k.diet_type || '—'}</div>
            </div>
            <div style={{ fontSize: 18, color: 'var(--terracotta)' }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}
