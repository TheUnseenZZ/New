import { useState } from 'react';
import { validateTemplate } from '../lib/templates';
import type { Template } from '../lib/types';

interface Props {
  existingIds: Set<string>;
  onClose: () => void;
  onImport: (t: Template) => void;
}

export function ImportTemplate({ existingIds, onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    let parsed: unknown;
    try {
      // Tolerate a ```json fenced block pasted straight from a chat.
      parsed = JSON.parse(text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, ''));
    } catch (e) {
      setErrors([`Not valid JSON: ${(e as Error).message}`]);
      return;
    }
    const errs = validateTemplate(parsed);
    if (errs.length) {
      setErrors(errs);
      return;
    }
    const t = parsed as Template;
    if (existingIds.has(t.id)) t.id = `${t.id}-${Date.now().toString(36).slice(-4)}`;
    onImport(t);
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Import a template</h3>
        <div className="note">
          Paste template JSON, e.g. one Claude generated for you. Ask Claude Code:{' '}
          <i>"make a lyric template that feels like …"</i>. See <code>TEMPLATES.md</code> for the format.
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "id": "my-style", "name": "My Style", … }' />
        {errors.length > 0 && (
          <div className="error">
            {errors.map((e) => (
              <div key={e}>• {e}</div>
            ))}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={!text.trim()}>
            Add template
          </button>
        </div>
      </div>
    </div>
  );
}
