import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';

export default function ProfileScreen() {
  const navigate = useStore((s) => s.navigate);
  const kids = useStore((s) => s.kids);
  const activeKidId = useStore((s) => s.activeKidId);
  const setActiveKid = useStore((s) => s.setActiveKid);
  const resetOnboardForm = useStore((s) => s.resetOnboardForm);

  return (
    <div className="screen animate-fade-in">
      <StatusBar />
      <div className="nav-header">
        <button className="nav-back" onClick={() => navigate('home')}>←</button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Family</div>
        <div style={{ width: 40 }} />
      </div>
      <div className="scrollable" style={{ padding: '8px 24px 24px' }}>
        <div className="section-label">YOUR KIDS</div>
        {kids.map((k) => (
          <div
            key={k.id}
            className="recent-item"
            onClick={() => { setActiveKid(k.id); navigate('home'); }}
            style={{ borderColor: k.id === activeKidId ? 'var(--terracotta)' : 'var(--line)' }}
          >
            <div className={`avatar ${k.colorClass}`} style={{ width: 44, height: 44 }}>{k.initial}</div>
            <div className="recent-info">
              <div className="recent-name">{k.name} {k.id === activeKidId && <span style={{ fontSize: 11, color: 'var(--terracotta)', marginLeft: 6 }}>· active</span>}</div>
              <div className="recent-brand">{k.age_band} · {k.gender || '—'} · {k.diet_type || '—'}</div>
            </div>
            <div style={{ fontSize: 18, color: 'var(--ink-muted)' }}>→</div>
          </div>
        ))}

        <button
          className="btn-ghost"
          onClick={() => { resetOnboardForm(); navigate('onboard2'); }}
          style={{ marginTop: 16 }}
        >
          + Add another child
        </button>
      </div>
    </div>
  );
}
