import { useMemo, useState } from 'react';
import type { DraftCategory } from './checklistEditor';
import { detectTextFormat, parseChecklistText } from './checklistText';
import { trackEvent } from './analytics';

/** Paste panel of the checklist editor: open state, the pasted text, its live split, and handing it to the draft. */
export function useChecklistTextImport(onImport: (categories: DraftCategory[]) => void) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const preview = useMemo(() => parseChecklistText(text), [text]);
  const itemCount = preview.reduce((sum, cat) => sum + cat.items.length, 0);

  const close = () => {
    setOpen(false);
    setText('');
  };

  const handleImport = () => {
    if (itemCount === 0) return;
    // Only the format is sent; never the text or how many items it had
    trackEvent('checklist_text_import', { format: detectTextFormat(text) });
    onImport(preview);
    close();
  };

  return { open, text, preview, itemCount, setText, openPanel: () => setOpen(true), close, handleImport };
}
