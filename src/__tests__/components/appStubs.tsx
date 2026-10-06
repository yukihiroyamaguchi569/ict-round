// Stand-ins for the screens App renders that jsdom cannot run: the add-photo screen needs
// canvas / createImageBitmap, and the report screen builds a .docx.

interface PhotoFormStubProps {
  linkedItemId?: string;
  categories: unknown[];
  onAdd: (photo: unknown) => void;
  onCancel: () => void;
}

/** Shows which item the photo is for, and hands App a fixed photo or cancels. */
export function PhotoFormStub({ linkedItemId, categories, onAdd, onCancel }: PhotoFormStubProps) {
  return (
    <div>
      <p data-testid="photo-form">{`${linkedItemId ?? 'general'}:${categories.length}`}</p>
      <button
        type="button"
        onClick={() => onAdd({ id: 'p-new', dataUrl: 'data:image/jpeg;base64,AA', comment: '汚れあり', timestamp: '07:05' })}
      >
        stub-add
      </button>
      <button type="button" onClick={onCancel}>
        stub-cancel
      </button>
    </div>
  );
}

interface ReportPreviewStubProps {
  roundData: unknown;
  categories: { category: string }[];
  onBack: () => void;
}

/** Shows the round data and categories App passes so the tests can read them back. */
export function ReportPreviewStub({ roundData, categories, onBack }: ReportPreviewStubProps) {
  return (
    <div>
      <pre data-testid="report-round">{JSON.stringify(roundData)}</pre>
      <p data-testid="report-categories">{categories.map((c) => c.category).join(',')}</p>
      <button type="button" onClick={onBack}>
        stub-back
      </button>
    </div>
  );
}
