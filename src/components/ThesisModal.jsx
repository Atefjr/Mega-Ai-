import { useEffect, useState } from 'react';

export default function ThesisModal({ open, onClose, onSubmit, initial = null, mode = 'create' }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📈');
  const [description, setDescription] = useState('');
  const [cautious, setCautious] = useState('');
  const [breaks, setBreaks] = useState('');
  const [example, setExample] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setIcon(initial?.icon || '📈');
      setDescription(initial?.description || '');
      setCautious(initial?.cautious_criteria || '');
      setBreaks(initial?.break_criteria || '');
      setExample(initial?.example_ticker || '');
      setError('');
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  if (!open) return null;
  const editing = mode === 'edit';

  async function submit() {
    setError('');
    if (!name.trim()) return setError('Thesis name is required.');
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        icon: icon.trim() || '📈',
        description: description.trim(),
        cautious_criteria: cautious.trim(),
        break_criteria: breaks.trim(),
        example_ticker: example.trim().toUpperCase(),
      });
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? 'Edit thesis' : 'New thesis'}</h3>
        <p className="modal-sub">A thesis is the reason behind a group of tickers. The cautious/breaks conditions sharpen how the AI scores its status.</p>

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
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="The core idea — why this should work." />
        </div>

        <div className="field">
          <label>What makes it cautious</label>
          <textarea rows={2} value={cautious} onChange={(e) => setCautious(e.target.value)}
            placeholder="Early warning signs that the thesis is weakening." />
        </div>

        <div className="field">
          <label>What breaks it</label>
          <textarea rows={2} value={breaks} onChange={(e) => setBreaks(e.target.value)}
            placeholder="Conditions that would invalidate the thesis outright." />
        </div>

        <div className="field">
          <label>Example ticker (optional)</label>
          <input className="mono" value={example} onChange={(e) => setExample(e.target.value.toUpperCase())} placeholder="NVDA" />
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? <span className="spinner" /> : editing ? 'Save changes' : 'Create thesis'}
          </button>
        </div>
      </div>
    </div>
  );
}
