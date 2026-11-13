import { useState } from 'react';
import { Upload, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, PageHeader, Badge, Alert, tableHead, tableCell, btnPrimary, btnSecondary } from '../../components/ui/UI';

const IMPORTERS = [
  {
    key: 'faculty',
    endpoint: 'faculty',
    title: 'Faculty',
    description: 'Creates faculty login accounts and profiles. Existing employee IDs are skipped, so reruns are safe.',
    columns: 'email, employeeId, name, designation, department [, phone, password]',
    template: 'email,employeeId,name,designation,department,phone\nfaculty1@novastra.edu.pk,F-1001,Dr. Ayesha Khan,Assistant Professor,Computer Science,+923001234567\n',
    templateName: 'faculty-import-template.csv',
  },
  {
    key: 'courses',
    endpoint: 'courses',
    title: 'Courses',
    description: 'Creates or updates the course catalog by course code. Import courses before historical grades.',
    columns: 'courseCode, title, creditHours, department [, description]',
    template: 'courseCode,title,creditHours,department,description\nCS-201,Object Oriented Programming,3,Computer Science,\n',
    templateName: 'courses-import-template.csv',
  },
  {
    key: 'semester-records',
    endpoint: 'semester-records',
    title: 'Historical Semester Records',
    description: 'Imports past semester GPA/CGPA summaries used by the transcript. Re-importing a semester updates it.',
    columns: 'rollNumber, semester, sgpa, cgpa, creditHours [, totalPoints]',
    template: 'rollNumber,semester,sgpa,cgpa,creditHours,totalPoints\nSP23-BSCS-001,1,3.45,3.45,17,\n',
    templateName: 'semester-records-template.csv',
  },
  {
    key: 'historical-grades',
    endpoint: 'historical-grades',
    title: 'Historical Course Grades',
    description: 'Imports past course grades. Creates inactive "MIGRATED" sections per course/semester/year; students must exist.',
    columns: 'rollNumber, courseCode, semester, year, gradeLetter [, totalMarks]',
    template: 'rollNumber,courseCode,semester,year,gradeLetter,totalMarks\nSP23-BSCS-001,CS-201,1,2023,A,88\n',
    templateName: 'historical-grades-template.csv',
  },
];

function downloadTemplate(importer) {
  const blob = new Blob([importer.template], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = importer.templateName;
  a.click();
  URL.revokeObjectURL(url);
}

function actionTone(action) {
  if (action === 'create') return 'green';
  if (action === 'update') return 'blue';
  return 'red';
}

export default function DataImport() {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(null);
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});

  async function run(importer, dryRun) {
    const file = files[importer.key];
    setErrors((e) => ({ ...e, [importer.key]: null }));
    if (!file) {
      setErrors((e) => ({ ...e, [importer.key]: 'Choose a CSV file first.' }));
      return;
    }
    setBusy(`${importer.key}:${dryRun ? 'validate' : 'import'}`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(
        `/admin/import/${importer.endpoint}${dryRun ? '?dryRun=1' : ''}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setResults((r) => ({ ...r, [importer.key]: res.data }));
      if (!dryRun) setFiles((f) => ({ ...f, [importer.key]: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, [importer.key]: apiMessage(err) }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Data Import"
        subtitle="Migrate faculty, courses and historical records from your existing student system (CSV)"
      />

      <Alert type="info">
        Every importer supports a <strong>dry run</strong> that validates the file and reports conflicts without writing.
        Student accounts are imported from the <strong>Students</strong> page. Maximum file size: 10 MB.
      </Alert>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        {IMPORTERS.map((importer) => {
          const result = results[importer.key];
          const validating = busy === `${importer.key}:validate`;
          const importing = busy === `${importer.key}:import`;
          return (
            <Card key={importer.key} title={importer.title} subtitle={importer.description}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <code className="text-[10px] text-[#465166] bg-[#f4f6f9] border border-[#e4e7ec] rounded px-2 py-1">
                    {importer.columns}
                  </code>
                  <button type="button" onClick={() => downloadTemplate(importer)} className="inline-flex items-center gap-1 text-[11px] text-[#1e3a8a] hover:underline bg-transparent border-0 p-0">
                    <Download size={12} /> Template
                  </button>
                </div>

                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    setFiles((f) => ({ ...f, [importer.key]: e.target.files?.[0] || null }));
                    setResults((r) => ({ ...r, [importer.key]: null }));
                  }}
                  className="block w-full text-[11px] text-[#465166] file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-[#eef2fb] file:text-[#1e3a8a] file:text-[11px] file:font-semibold hover:file:bg-[#e3eafb]"
                />

                {errors[importer.key] && <Alert type="error">{errors[importer.key]}</Alert>}

                <div className="flex gap-2">
                  <button type="button" onClick={() => run(importer, true)} disabled={Boolean(busy)} className={btnSecondary}>
                    {validating ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                    Validate (dry run)
                  </button>
                  <button type="button" onClick={() => run(importer, false)} disabled={Boolean(busy)} className={btnPrimary}>
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Import
                  </button>
                </div>

                {result && (
                  <div className="rounded-lg border border-[#e4e7ec] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#f9fafc] border-b border-[#e4e7ec] text-[11px] flex-wrap">
                      {result.dryRun && <Badge tone="amber">dry run</Badge>}
                      <span className="text-[#11875d] font-semibold">{result.created} created</span>
                      <span className="text-[#274b9f] font-semibold">{result.updated} updated</span>
                      <span className="text-[#a03333] font-semibold">{result.skipped} skipped</span>
                      {result.sectionsCreated > 0 && <span className="text-[#697386]">{result.sectionsCreated} sections created</span>}
                    </div>
                    <div className="max-h-48 overflow-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className={tableHead}>Row</th>
                            <th className={tableHead}>Key</th>
                            <th className={tableHead}>Action</th>
                            <th className={tableHead}>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.results.map((r) => (
                            <tr key={`${r.line}-${r.key}`}>
                              <td className={tableCell}>{r.line}</td>
                              <td className={tableCell}>{r.key}</td>
                              <td className={tableCell}><Badge tone={actionTone(r.action)}>{r.action}</Badge></td>
                              <td className={tableCell}>{r.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
