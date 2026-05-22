import React from 'react';

export default function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <div className="icons">
        <span style={{ fontSize: 12 }}>●●●●</span>
        <span style={{ fontSize: 12 }}>📶</span>
        <span style={{ fontSize: 12 }}>🔋</span>
      </div>
    </div>
  );
}
