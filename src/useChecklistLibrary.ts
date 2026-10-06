import { useState } from 'react';
import type { SavedChecklist } from './types';
import { seedDefaultIfFirstRun, getActiveId, setActiveId, addChecklist, deleteChecklist } from './checklistStorage';

function initLibraryAndActive(): { library: SavedChecklist[]; activeId: string } {
  const library = seedDefaultIfFirstRun();
  const savedId = getActiveId();
  const activeId = library.find((c) => c.id === savedId) ? savedId! : library[0].id;
  return { library, activeId };
}

/** The checklist library and the active checklist, kept in sync with localStorage. */
export function useChecklistLibrary() {
  const [{ library, activeId }, setLibraryState] = useState(initLibraryAndActive);

  const activeChecklist = library.find((c) => c.id === activeId) ?? library[0];

  const select = (id: string) => {
    setActiveId(id);
    setLibraryState((prev) => ({ ...prev, activeId: id }));
  };

  const add = (c: SavedChecklist) => {
    addChecklist(c);
    setLibraryState((prev) => ({ library: [...prev.library, c], activeId: prev.activeId }));
  };

  const remove = (id: string) => {
    deleteChecklist(id);
    setLibraryState((prev) => {
      const newLib = prev.library.filter((c) => c.id !== id);
      const newActiveId = prev.activeId === id ? newLib[0]?.id ?? '' : prev.activeId;
      if (newActiveId) setActiveId(newActiveId);
      return { library: newLib, activeId: newActiveId };
    });
  };

  return { library, activeId, activeChecklist, select, add, remove };
}
