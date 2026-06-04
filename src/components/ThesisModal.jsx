import { useEffect, useState } from 'react';

export default function ThesisModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📈');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(''); setIcon('📈'); setDescription(''); setError(''); setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    setError('');
    if (!name.trim()) return setError('Thesis name is required.');
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon: icon.trim() || '📈', description: description.trim() });
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New thesis</h3>
        <p className="modal-sub">A thesis is the reason behind a group of tickers. AI will track whether it stays intact in Slice 2.</p>

        <div className="field-row">
          <div className="field" style={{ flex: '0 0 84px' }}>
            <label>Icon</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} style={{ textAlign: 'center' }} />
          </div>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="AI Infrastructure Buildout" autoFocus />
          </div>
        </div>

        <div className="field">
          <label>Thesis (written out)</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the core idea, and what would keep it intact vs. break it?" />
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? <span className="spinner" /> : 'Create thesis'}
          </button>
        </div>
      </div>
    </div>
  );
}
