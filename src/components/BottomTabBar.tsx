type MainTab = 'checklist' | 'photos' | 'evaluation';

interface Props {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onReport: () => void;
  photoCount: number;
  hasEvaluation: boolean;
}

const TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'checklist',
    label: 'チェック',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'photos',
    label: '写真',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'evaluation',
    label: '総評',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
];

export default function BottomTabBar({ activeTab, onTabChange, onReport, photoCount, hasEvaluation }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 bg-surface/95 backdrop-blur-lg border-t border-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'photos' && photoCount > 0;
          const showCheck = tab.id === 'evaluation' && hasEvaluation;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors duration-150"
              style={{ color: isActive ? 'var(--t-primary)' : 'var(--t-text-faint)' }}
            >
              <div className="relative">
                {tab.icon}
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: 'var(--t-primary)', fontSize: '9px' }}
                  >
                    {photoCount}
                  </span>
                )}
                {showCheck && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center"
                    style={{ backgroundColor: '#059669', width: '16px', height: '16px' }}
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{tab.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--t-primary)' }}
                />
              )}
            </button>
          );
        })}

        {/* Report button */}
        <div className="flex items-center px-3 border-l border-line">
          <button
            type="button"
            onClick={onReport}
            className="btn-primary px-4 py-2.5 text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            レポート
          </button>
        </div>
      </div>
    </div>
  );
}
