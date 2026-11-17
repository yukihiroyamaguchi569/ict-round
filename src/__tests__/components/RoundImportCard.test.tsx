import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundImportCard from '../../facility/RoundImportCard';
import type { MergeReport } from '../../facility/mergeFacilityRounds';

function report(overrides: Partial<MergeReport> = {}): MergeReport {
  return {
    addedDepartments: [],
    conflicts: [],
    unknownItems: [],
    notApplicableCells: 0,
    differentDay: false,
    addedPhotos: 0,
    ...overrides,
  };
}

describe('RoundImportCard', () => {
  it('explains the import and hands the chosen file over', async () => {
    const onFile = vi.fn();
    render(<RoundImportCard importing={false} outcome={null} onFile={onFile} />);
    expect(screen.getByText(/○ と × が食い違ったマスは × になります。取り込みは取り消せません。/)).toBeInTheDocument();
    const file = new File(['docx'], 'b.docx');
    await userEvent.upload(screen.getByLabelText('Word のファイルを選ぶ'), file);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cannot choose another file while importing', () => {
    render(<RoundImportCard importing outcome={null} onFile={vi.fn()} />);
    expect(screen.getByLabelText('取り込み中...')).toBeDisabled();
  });

  it('lists everything the import did', () => {
    render(
      <RoundImportCard
        importing={false}
        onFile={vi.fn()}
        outcome={{
          kind: 'imported',
          report: report({
            differentDay: true,
            addedDepartments: ['透析室', '内視鏡室'],
            conflicts: [
              { department: '3東', itemText: '高頻度接触面が清拭されている' },
              { department: '3西', itemText: '汚物処理室に汚れがない' },
            ],
            unknownItems: ['古い項目'],
            notApplicableCells: 2,
            addedPhotos: 3,
          }),
        }}
      />
    );
    const result = screen.getByRole('status', { name: '取り込みの結果' });
    expect(within(result).getByText('取り込みました')).toBeInTheDocument();
    expect(within(result).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '違う日のラウンドの記録でした。日付が合っているか確かめてください。',
      '足した部署: 透析室、内視鏡室',
      '食い違ったため × にしたマス: 3東：高頻度接触面が清拭されている',
      '食い違ったため × にしたマス: 3西：汚物処理室に汚れがない',
      'このラウンドに無いため取り込めなかった項目: 古い項目',
      '対象外のため入れなかったマス: 2 個',
      '足した写真: 3 枚',
    ]);
  });

  it('shows only "取り込みました" when the import only filled empty cells', () => {
    render(<RoundImportCard importing={false} onFile={vi.fn()} outcome={{ kind: 'imported', report: report() }} />);
    const result = screen.getByRole('status', { name: '取り込みの結果' });
    expect(within(result).getByText('取り込みました')).toBeInTheDocument();
    expect(within(result).queryByRole('list')).toBeNull();
  });

  it('says when nothing was new', () => {
    render(<RoundImportCard importing={false} onFile={vi.fn()} outcome={{ kind: 'unchanged' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('新しい内容はありませんでした。');
  });

  it('shows a failure as an alert', () => {
    render(<RoundImportCard importing={false} onFile={vi.fn()} outcome={{ kind: 'failed', message: '取り込めませんでした。' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('取り込めませんでした。');
  });
});
