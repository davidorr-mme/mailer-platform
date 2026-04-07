import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { importsApi } from '../../api/imports';
import { ImportHistory } from '../../types';
import Pagination from '../../components/Pagination';

type ImportType = 'contacts' | 'events';
type WizardStep = 1 | 2 | 3 | 4;
type Tab = 'new' | 'history';

interface ColumnMapping {
  columnName: string;
  mappedTo: string;
}

const CONTACT_SYSTEM_FIELDS = ['email', 'skip'];
const EVENT_SYSTEM_FIELDS = ['email', 'event_name', 'occurred_at', 'metadata', 'skip'];

function ImportHistoryTab() {
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await importsApi.getImportHistory(page, 20);
      setHistory(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load import history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [page]);

  const handleDownloadErrors = async (id: string) => {
    try {
      const data = await importsApi.downloadErrors(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-errors-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download errors');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {loading ? (
        <div className="p-12 flex justify-center">
          <svg className="animate-spin w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : history.length === 0 ? (
        <div className="p-12 text-center text-gray-400 text-sm">No imports yet</div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">File</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Rows</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Created</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Updated</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Errors</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(new Date(h.createdAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      h.importType === 'contacts' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {h.importType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{h.fileName}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{h.rowsProcessed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{h.contactsCreated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{h.contactsUpdated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm ${h.errorsCount > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {h.errorsCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {h.errorsCount > 0 && (
                      <button
                        onClick={() => handleDownloadErrors(h.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Download Errors
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function DataImport() {
  const [tab, setTab] = useState<Tab>('new');
  const [step, setStep] = useState<WizardStep>(1);
  const [importType, setImportType] = useState<ImportType>('contacts');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const resetWizard = () => {
    setStep(1);
    setSelectedFile(null);
    setColumns([]);
    setPreview([]);
    setMappings([]);
    setResult(null);
  };

  const handleFileSelect = (file: File) => {
    const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      toast.error('Only CSV and XLSX files are supported');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const data = await importsApi.uploadFile(selectedFile);
      setColumns(data.columns);
      setPreview(data.preview);
      const initialMappings: ColumnMapping[] = data.columns.map((col) => ({
        columnName: col,
        mappedTo: col.toLowerCase() === 'email' ? 'email' : 'skip',
      }));
      setMappings(initialMappings);
      setStep(3);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRunImport = async () => {
    if (!selectedFile) return;
    setRunning(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('importType', importType);
      formData.append('mappings', JSON.stringify(mappings));
      const data = await importsApi.executeImport(formData);
      setResult(data);
      setStep(4);
      toast.success('Import completed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally {
      setRunning(false);
    }
  };

  const systemFields = importType === 'contacts' ? CONTACT_SYSTEM_FIELDS : EVENT_SYSTEM_FIELDS;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Data Import</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {([['new', 'New Import'], ['history', 'Import History']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'history' && <ImportHistoryTab />}

      {tab === 'new' && (
        <div className="max-w-3xl">
          {/* Step 1: Select Type */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Import Type</h2>
              <div className="grid grid-cols-2 gap-4">
                {([
                  {
                    type: 'contacts' as ImportType,
                    title: 'Contact & Attributes Import',
                    desc: 'Create new contacts or update existing contact attributes',
                    icon: (
                      <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                  },
                  {
                    type: 'events' as ImportType,
                    title: 'Events Import',
                    desc: 'Append historical event records to existing contacts',
                    icon: (
                      <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    ),
                  },
                ] as const).map(({ type, title, desc, icon }) => (
                  <button
                    key={type}
                    onClick={() => { setImportType(type); setStep(2); }}
                    className={`p-6 bg-white border-2 rounded-xl text-left hover:border-indigo-400 hover:bg-indigo-50 transition-colors ${
                      importType === type ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="mb-3">{icon}</div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                <h2 className="text-lg font-semibold text-gray-800">
                  {importType === 'contacts' ? 'Contact & Attributes Import' : 'Events Import'}
                </h2>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm text-gray-600 font-medium mb-1">
                  {selectedFile ? selectedFile.name : 'Drag & drop your XLSX or CSV file here, or click to browse'}
                </p>
                <p className="text-xs text-gray-400">Supports CSV and XLSX. Max 50MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              <div className="mt-4 flex gap-4">
                <a
                  href="/api/imports/sample/contacts"
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download contacts template
                </a>
                <a
                  href="/api/imports/sample/events"
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download events template
                </a>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-md disabled:opacity-60"
                >
                  {uploading ? 'Uploading...' : 'Next: Map Columns'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Map Columns */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                <h2 className="text-lg font-semibold text-gray-800">Map Columns</h2>
              </div>

              {importType === 'events' && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  Note: Duplicate events will be created if this file has been imported before.
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">File Column</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Map To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mappings.map((mapping, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{mapping.columnName}</td>
                        <td className="px-4 py-3">
                          <select
                            value={mapping.mappedTo}
                            onChange={(e) => {
                              const updated = [...mappings];
                              updated[idx] = { ...updated[idx], mappedTo: e.target.value };
                              setMappings(updated);
                            }}
                            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-xs"
                          >
                            <option value="skip">— Skip this column —</option>
                            {systemFields.filter((f) => f !== 'skip').map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (first 5 rows)</h3>
                  <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {columns.map((col) => (
                            <th key={col} className="px-3 py-2 text-left font-medium text-gray-500 uppercase">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.slice(0, 5).map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-3 py-2 text-gray-600 max-w-xs truncate">{String(cell ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleRunImport}
                  disabled={running}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-md disabled:opacity-60"
                >
                  {running ? 'Importing...' : 'Run Import'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Summary */}
          {step === 4 && result && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-5">Import Complete</h2>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-800">Import completed successfully</span>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 mb-6">
                {[
                  { label: 'Rows Processed', value: result.rowsProcessed ?? 0 },
                  { label: 'Contacts Created', value: result.contactsCreated ?? 0 },
                  { label: 'Contacts Updated', value: result.contactsUpdated ?? 0 },
                  { label: 'Events Created', value: result.eventsCreated ?? 0 },
                  { label: 'Errors', value: result.errorsCount ?? result.errors ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className={`text-sm font-semibold ${label === 'Errors' && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {Number(value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {(result.errorsCount > 0 || result.errors > 0) && result.importId && (
                <button
                  onClick={async () => {
                    try {
                      const data = await importsApi.downloadErrors(result.importId);
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `import-errors-${result.importId}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error('Failed to download errors');
                    }
                  }}
                  className="mb-4 w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Error Log
                </button>
              )}

              <button
                onClick={resetWizard}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-md"
              >
                Start New Import
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
