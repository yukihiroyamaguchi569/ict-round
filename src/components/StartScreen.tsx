import type { useChecklistLibrary } from '../useChecklistLibrary';
import type { useWhatsNew } from '../useWhatsNew';
import RoundStart from './RoundStart';
import WhatsNewDialog from './WhatsNewDialog';

interface Props {
  checklists: ReturnType<typeof useChecklistLibrary>;
  whatsNew: ReturnType<typeof useWhatsNew>;
  savedRoundsCount: number;
  featureSample: boolean;
  initialName: string;
  onStart: (name: string, wardName: string) => void;
  onStartSample: () => Promise<void>;
  onViewSaved: () => void;
}

/** The start screen, with the "what's new" announcement over it after an update. */
export default function StartScreen({ checklists, whatsNew, savedRoundsCount, featureSample, initialName, onStart, onStartSample, onViewSaved }: Props) {
  const { unseenReleases, closeWhatsNew } = whatsNew;

  return (
    <>
      {/* While the announcement is open, keep the start screen out of reach of typing, Enter and Tab */}
      <div inert={unseenReleases.length > 0}>
        <RoundStart
          library={checklists.library}
          activeId={checklists.activeId}
          savedRoundsCount={savedRoundsCount}
          featureSample={featureSample}
          initialName={initialName}
          onStart={onStart}
          onStartSample={onStartSample}
          onSelectChecklist={checklists.select}
          onAddChecklist={checklists.add}
          onDeleteChecklist={checklists.remove}
          onViewSaved={onViewSaved}
        />
      </div>
      {unseenReleases.length > 0 && (
        <WhatsNewDialog releases={unseenReleases} onClose={closeWhatsNew} />
      )}
    </>
  );
}
