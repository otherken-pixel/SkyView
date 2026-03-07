import React, { useState, useRef } from 'react';
import { MdIcon, MdButton } from '../common';

export default function DataModal({ trips, onImport, onClose }) {
  const [toast, setToast] = useState('');
  const importRef = useRef();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function triggerBlobLink(blob, opts) {
    opts = opts || {};
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    if (opts.download) a.download = opts.download;
    if (opts.newTab) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    const delay = opts.revokeMs != null ? opts.revokeMs : 0;
    if (delay > 0) { setTimeout(() => URL.revokeObjectURL(url), delay); }
    else { URL.revokeObjectURL(url); }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' });
    triggerBlobLink(blob, { download: 'flightscore-trips-' + new Date().toISOString().slice(0, 10) + '.json' });
    showToast('Trips exported!');
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error();
        onImport(data);
        showToast(data.length + ' trip(s) imported!');
        setTimeout(onClose, 1500);
      } catch(_ex) {
        showToast('Invalid file — could not import.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <div className="ios-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="My Trip Data">
      <div className="ios-sheet">
        <div className="ios-sheet-grabber" />
        <div style={{ padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>My Trip Data</div>
            <button onClick={onClose} aria-label="Close" style={{
              background: 'var(--card-high)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
              minWidth: 44, minHeight: 44, padding: 6
            }}>
              <MdIcon name="close" style={{ fontSize: 20 }} />
            </button>
          </div>
          {toast && (
            <div role="alert" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, textAlign: 'center' }}>{toast}</div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Trips are automatically saved in this browser. Use export/import to move trips between devices, or to keep a backup.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MdButton variant="tonal" icon="download" onClick={handleExport}>
              Export trips as JSON ({trips.length} trip{trips.length !== 1 ? 's' : ''})
            </MdButton>
            <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportFile} />
            <MdButton variant="tonal" icon="upload" onClick={() => importRef.current && importRef.current.click()}>
              Import trips from JSON
            </MdButton>
          </div>
        </div>
      </div>
    </div>
  );
}
