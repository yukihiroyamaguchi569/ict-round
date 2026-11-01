import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportPreview from '../../components/ReportPreview';
import { trackEvent } from '../../analytics';
import { ThemeProvider } from '../../ThemeContext';
import type { ChecklistCategory, RoundData } from '../../types';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));
// The tests are about the open event, so skip the real Word build
vi.mock('../../docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../docx')>();
  return { ...actual, buildDocxBlob: vi.fn(() => Promise.resolve(new Blob(['docx']))) };
});
vi.mock('../../roundExportDocx', () => ({ embedRoundExport: vi.fn((blob: Blob) => Promise.resolve(blob)) }));

const categories: ChecklistCategory[] = [
  { category: '手指衛生', items: [{ id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' }] },
];

const roundData: RoundData = {
  inspectorName: '田中 一郎',
  wardName: '3階東病棟',
  startTime: '2026/10/06 07:00',
  checklistResults: [
    { itemId: 'h1', rating: 'C', photos: [{ id: 'p1', dataUrl: 'data:image/jpeg;base64,AAAA', comment: '消毒剤が空', timestamp: '2026/10/06 07:05' }] },
  ],
  generalPhotos: [],
  overallEvaluation: '手指消毒剤の補充が遅れている',
};

function preview(isSample?: boolean) {
  return (
    <ThemeProvider>
      <ReportPreview roundData={roundData} categories={categories} isSample={isSample} onBack={() => {}} />
    </ThemeProvider>
  );
}

const openCalls = () => vi.mocked(trackEvent).mock.calls.filter(([name]) => name === 'report_open');

afterEach(() => {
  vi.clearAllMocks();
});

describe('ReportPreview report_open event', () => {
  it('is sent once when the report screen opens', async () => {
    render(preview());
    await screen.findByRole('button', { name: 'Word出力' });

    expect(openCalls()).toEqual([['report_open', { sample: false }]]);
  });

  it('marks the sample round as a sample', async () => {
    render(preview(true));
    await screen.findByRole('button', { name: 'Word出力' });

    expect(openCalls()).toEqual([['report_open', { sample: true }]]);
  });

  it('is not sent again when the screen re-renders', async () => {
    const { rerender } = render(preview());
    await screen.findByRole('button', { name: 'Word出力' });

    rerender(preview());
    rerender(preview());

    expect(openCalls()).toHaveLength(1);
  });

  it('is sent once under StrictMode, which runs effects twice on mount', async () => {
    render(<StrictMode>{preview()}</StrictMode>);
    await screen.findByRole('button', { name: 'Word出力' });

    expect(openCalls()).toHaveLength(1);
  });

  it('is sent again when the report screen is opened anew', async () => {
    const first = render(preview());
    await screen.findByRole('button', { name: 'Word出力' });
    first.unmount();

    render(preview());
    await screen.findByRole('button', { name: 'Word出力' });

    expect(openCalls()).toHaveLength(2);
  });

  it('carries none of the round data', async () => {
    render(preview());
    await screen.findByRole('button', { name: 'Word出力' });

    const calls = openCalls();
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0][1] ?? {})).toEqual(['sample']);
    expect(JSON.stringify(calls)).not.toMatch(/田中|3階東病棟|手指|消毒剤|base64|2026\/10\/06|07:05/);
  });
});
