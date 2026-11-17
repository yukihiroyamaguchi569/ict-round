import { useEffect, useRef } from 'react';
import { complianceRateText, departmentCompliance, departmentsByGroup, type FacilityRound } from './facilityRound';
import { useFacilityReportFile } from './useFacilityReportFile';
import { ReportExportButton, ReportExportNotices } from '../components/ReportExport';

interface Props {
  round: FacilityRound;
  /** Photo images by id; null while they are being read. */
  photoData: Record<string, string> | null;
}

/** The round's report: compliance per department, and the Word file to share or save. */
export default function ReportScreen({ round, photoData }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const file = useFacilityReportFile(round, photoData);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <h2 ref={heading} tabIndex={-1} className="flex-1 text-xl font-extrabold text-text focus:outline-none">
            帳票
          </h2>
          <ReportExportButton file={file} />
        </div>
        <p className="text-sm text-text-muted">書き出した Word が、この端末の記録の控えになります。ほかの端末で取り込むこともできます。</p>
      </div>
      <ReportExportNotices buildError={file.buildError} shareFailed={file.shareFailed} />

      {departmentsByGroup(round).map(({ group, departments }) => (
        <section key={group} aria-label={group} className="card p-5">
          <h3 className="text-sm font-extrabold text-text mb-3">{group}</h3>
          <ul className="divide-y divide-line">
            {departments.map((department) => {
              const compliance = departmentCompliance(round, department.name);
              return (
                <li key={department.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                  <span className="flex-1 min-w-0 text-base font-bold text-text break-words">{department.name}</span>
                  <span className="text-sm text-text-muted">○ {compliance.ok}</span>
                  <span className="text-sm text-text-muted">× {compliance.ng}</span>
                  <span className="text-sm font-bold text-text w-28 text-right">遵守率 {complianceRateText(compliance)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
