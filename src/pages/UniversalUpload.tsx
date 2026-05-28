import { useCallback, useEffect, useState } from 'react';
import {
  Card, Text, Group, Stack, Button, Badge, rem,
  Tabs, Select, TextInput, NumberInput
} from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import {
  IconFileSpreadsheet, IconUpload, IconX, IconKeyboard,
  IconCalendar, IconAnalyze, IconCircleCheck,
  IconChartBar
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';

const MotionDiv = motion.create('div' as any);

type UploadStep = 'drop' | 'analyzing' | 'complete';

export default function UniversalUpload() {
  const navigate = useNavigate();
  const { doctors, pharmacies, fetchDoctors, fetchPharmacies } = useAppStore();
  const [step, setStep] = useState<UploadStep>('drop');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  const [detectedModule, setDetectedModule] = useState<string | null>(null);

  // Manual Entry States
  const [manualEntry, setManualEntry] = useState({
    doctorId: '', pharmacyId: '', productName: '', amount: '', date: new Date()
  });
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    if (doctors.length === 0) fetchDoctors();
    if (pharmacies.length === 0) fetchPharmacies();
  }, [doctors.length, pharmacies.length, fetchDoctors, fetchPharmacies]);

  const handleDrop = useCallback(async (files: FileWithPath[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(ext || '')) {
      notifications.show({ title: 'Invalid File Type', message: 'Please upload .xlsx, .xls, .csv, or .pdf', color: 'red', icon: <IconX size={18} /> });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      notifications.show({ title: 'File Too Large', message: 'Maximum file size is 50MB', color: 'red', icon: <IconX size={18} /> });
      return;
    }

    setStep('analyzing');
    setDetectedModule('Scanning file structure...');

    /**
     * MINIMUM_SCAN_MS: The user must see the scanning animation for at
     * least 6 seconds regardless of how fast the server responds.
     */
    const MINIMUM_SCAN_MS = 6000;
    const TICK_MS         = 80;           // Refresh every 80ms (≈12 fps smooth)
    const totalTicks      = MINIMUM_SCAN_MS / TICK_MS;
    const dropTime        = Date.now();

    // Mutable refs shared between the ticker closure and the async API path
    let tickCount      = 0;
    let resolvedLabel  = '';    // Populated once the API call returns
    let resolvedTarget = 100;  // Default; overwritten with real confidence score

    /**
     * Smooth confidence ticker.
     * Runs concurrently with the API call.
     * Animates 0% → resolvedTarget% using ease-out quadratic over 6 seconds.
     * While API is in-flight it shows contextual scan phrases.
     * Once the API responds it shows the real format + confidence %.
     */
    const SCAN_PHRASES = [
      'Scanning file structure...',
      'Mapping column headers...',
      'Validating row signatures...',
      'Running heuristic matching...',
      'Cross-referencing schema...',
      'Finalizing format detection...',
    ];

    const ticker = setInterval(() => {
      tickCount++;
      const linearProgress = Math.min(tickCount / totalTicks, 1);
      const eased          = 1 - Math.pow(1 - linearProgress, 2);  // ease-out quad
      const displayPct     = Math.round(eased * resolvedTarget);

      if (resolvedLabel) {
        setDetectedModule(`${resolvedLabel} (${displayPct}% Confidence)`);
      } else {
        const phraseIdx = Math.min(
          Math.floor(linearProgress * SCAN_PHRASES.length),
          SCAN_PHRASES.length - 1
        );
        setDetectedModule(SCAN_PHRASES[phraseIdx]);
      }

      if (tickCount >= totalTicks) clearInterval(ticker);
    }, TICK_MS);

    // API call runs in parallel with the ticker
    try {
      /**
       * Prefer the Electron-native file.path transfer path.
       *
       * WHY: The previous approach — Array.from(new Uint8Array(arrayBuffer)) — converted a
       * multi-MB file buffer into a plain JS Array of Numbers on the renderer main thread.
       * For a 1.5 MB file this allocated ~1.5 million Number objects synchronously, blocking
       * the event loop for 2–4 seconds and freezing every running animation and skeleton loader.
       *
       * The fix: send only the file.path string to the backend. The Hono server reads the
       * file with fs.readFileSync on the Node.js thread — zero renderer allocation.
       *
       * Fallback: if file.path is not available (e.g., web context without Electron file access),
       * fall back to the original ArrayBuffer → Array serialization path.
       */
      const filePath = (file as any).path as string | undefined;

      let result;
      if (filePath) {
        // Primary path — Electron desktop: send the OS file path, backend reads file directly
        result = await api.post('/api/upload/intelligent/upload-by-path', {
          filePath,
          fileName: file.name,
        });
      } else {
        // Fallback path — non-Electron or missing path: serialize buffer on renderer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array  = new Uint8Array(arrayBuffer);
        const bufferArray = Array.from(uint8Array);
        result = await api.post('/api/upload/intelligent/upload', {
          buffer:   bufferArray,
          fileName: file.name,
        });
      }

      if (!result.success) throw new Error(result.error);

      const newUploadId      = (result as any).uploadId;
      const formatStr        = (result as any).format;
      const confidenceScore  = (result as any).confidence ?? 0;

      const formatLabels: Record<string, string> = {
        party_report: 'Sales Report',
        product:      'Product Master',
        doctor:       'Doctor Master',
        pharmacy:     'Pharmacy Master',
        unknown:      'Unknown Format',
      };

      // Publish results to ticker closure
      resolvedLabel  = formatLabels[formatStr] || formatLabels.unknown;
      resolvedTarget = Math.round(confidenceScore * 100);

      setUploadId(newUploadId);

      // Wait for the remainder of the 6-second minimum before transitioning
      const elapsed   = Date.now() - dropTime;
      const remaining = Math.max(0, MINIMUM_SCAN_MS - elapsed);
      await new Promise<void>(resolve => setTimeout(resolve, remaining + 400));

      setStep('complete');

    } catch (error: any) {
      clearInterval(ticker);
      notifications.show({
        title:   'Upload Failed',
        message: String(error?.message || error),
        color:   'red',
        icon:    <IconX size={18} />
      });
      handleReset();
    } finally {
      setIsDragging(false);
    }
  }, []);

  const handleReset = () => {
    setStep('drop');
    setUploadId(null);
    setProcessingComplete(false);
    setDetectedModule(null);
  };

  // Poll for processing completion when we have an uploadId and are on the complete step
  useEffect(() => {
    if (!uploadId || step !== 'complete') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await api.get(`/api/upload/intelligent/status/${uploadId}`);
        if (cancelled) return;
        if (result.success && (result as any).status === 'COMPLETED') {
          setProcessingComplete(true);
          const format = (result as any).format;
          if (format === 'party_report') {
            notifications.show({
              title: 'Processing Complete',
              message: 'Sales Report data has been parsed and integrated successfully.',
              color: 'green',
              icon: <IconCircleCheck size={18} />
            });
            navigate(`/analytics?uploadId=${uploadId}`);
          } else if (format === 'product') {
            notifications.show({
              title: 'Processing Complete',
              message: 'Product Master data has been parsed and integrated successfully.',
              color: 'green',
              icon: <IconCircleCheck size={18} />
            });
            navigate('/products');
          } else if (format === 'doctor') {
            notifications.show({
              title: 'Processing Complete',
              message: 'Doctor Master data has been parsed and integrated successfully.',
              color: 'green',
              icon: <IconCircleCheck size={18} />
            });
            navigate('/doctors');
          } else if (format === 'pharmacy') {
            notifications.show({
              title: 'Processing Complete',
              message: 'Pharmacy Master data has been parsed and integrated successfully.',
              color: 'green',
              icon: <IconCircleCheck size={18} />
            });
            navigate('/pharmacies');
          } else {
            notifications.show({
              title: 'Processing Complete',
              message: 'Data has been parsed and integrated successfully.',
              color: 'green',
              icon: <IconCircleCheck size={18} />
            });
            handleReset();
          }

        } else if (result.success && (result as any).status === 'ERROR') {
          setProcessingComplete(true); // still allow viewing
          notifications.show({
            title: 'Processing Failed',
            message: (result as any).error || 'An error occurred during processing.',
            color: 'red',
            icon: <IconX size={18} />
          });
        } else {
          // Poll again after 2 seconds
          setTimeout(() => { if (!cancelled) poll(); }, 2000);
        }
      } catch {
        if (!cancelled) setTimeout(() => poll(), 3000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [uploadId, step, navigate]);

  const handleManualSubmit = async () => {
    if (!manualEntry.doctorId || !manualEntry.pharmacyId || !manualEntry.productName || !manualEntry.amount) {
      notifications.show({ title: 'Missing Fields', message: 'Please fill all required fields', color: 'red' });
      return;
    }
    setSavingManual(true);
    try {
      const result = await api.post('/api/products/link', {
        doctorId: Number(manualEntry.doctorId), pharmacyId: Number(manualEntry.pharmacyId),
        productName: manualEntry.productName, amount: Number(manualEntry.amount),
        date: manualEntry.date.toISOString()
      });
      if (result.success) {
        notifications.show({ title: 'Success', message: 'Manual entry saved successfully', color: 'green' });
        setManualEntry({ doctorId: '', pharmacyId: '', productName: '', amount: '', date: new Date() });
      } else { throw new Error(result.error); }
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message || 'Failed to save entry', color: 'red' });
    } finally { setSavingManual(false); }
  };

  const renderDropZone = () => (
    <MotionDiv initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="relative rounded-2xl overflow-hidden transition-all duration-300">
        <Dropzone 
          onDrop={handleDrop} 
          onReject={(files) => {
            notifications.show({ title: 'File Rejected', message: files[0]?.errors[0]?.message || 'Invalid file', color: 'red' });
            setIsDragging(false);
          }}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          maxSize={50 * 1024 * 1024} 
          className={`border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-12 text-center transition-all duration-300 bg-white/40 backdrop-blur-md cursor-pointer relative overflow-hidden shadow-inner hover:shadow-indigo-500/10 ${isDragging ? 'border-indigo-600 bg-white/60 ring-4 ring-indigo-500/20' : ''}`}
        >
          <Group justify="center" gap="xl" mih={240} style={{ pointerEvents: 'none' }}>
            <Dropzone.Accept><IconUpload style={{ width: rem(56), height: rem(56), color: '#6366f1' }} stroke={1.5} /></Dropzone.Accept>
            <Dropzone.Reject><IconX style={{ width: rem(56), height: rem(56), color: '#ef4444' }} stroke={1.5} /></Dropzone.Reject>
            <Dropzone.Idle>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white mx-auto shadow-lg shadow-indigo-500/30 animate-float">
                <IconFileSpreadsheet style={{ width: rem(48), height: rem(48) }} stroke={1.5} />
              </div>
            </Dropzone.Idle>
            <Stack gap="xs" align="center">
              <Text size="xl" inline fw={800} className="bg-gradient-to-r from-slate-800 to-indigo-600 bg-clip-text text-transparent font-extrabold tracking-tight">Drop your data file here</Text>
              <Text size="sm" c="dimmed" inline className="text-slate-400 font-semibold mt-1">or click to browse from explorer</Text>
              <Group gap="xs" mt="md">
                <Badge variant="light" color="indigo" size="sm">Doctor Data</Badge>
                <Badge variant="light" color="green" size="sm">Pharmacy Data</Badge>
                <Badge variant="light" color="yellow" size="sm">Products</Badge>
                <Badge variant="light" color="blue" size="sm">Sales Reports</Badge>
                <Badge variant="light" color="red" size="sm">PDF Files</Badge>
              </Group>
              <Text size="xs" c="dimmed" mt={8} className="text-slate-400">.xlsx, .xls, .csv, .pdf — max 50MB — automated column-mapping heuristics</Text>
            </Stack>
          </Group>
        </Dropzone>
      </div>
    </MotionDiv>
  );

  const renderAnalyzing = () => (
    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative w-24 h-24 flex items-center justify-center mb-6">
        <IconAnalyze size={56} className="text-indigo-600 z-10 animate-pulse" stroke={1.5} />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent shadow-[0_0_15px_#14b8a6] z-20 animate-scan" />
      </div>
      <Text size="lg" fw={800} mt="lg" className="text-slate-800 font-extrabold">Analyzing Document Heuristics...</Text>
      <Text size="sm" c="dimmed" mt="xs" className="text-slate-500 font-medium">
        {detectedModule ? `Detected: ${detectedModule}` : 'Mapping Excel columns and validating row signatures'}
      </Text>
      {detectedModule && (
        <Text size="xs" c="dimmed" mt="md" className="text-slate-400">Processing database ingestion in background thread...</Text>
      )}
    </MotionDiv>
  );

  const renderComplete = () => (
    <MotionDiv initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 mb-6">
        <IconCircleCheck size={48} />
      </div>
      <Text size="xl" fw={800} className="text-slate-800 font-extrabold">Upload Received!</Text>
      <Text size="sm" c="dimmed" mt="xs" mb="xl" className="text-slate-500 max-w-sm">
        {processingComplete
          ? 'Your data has been processed successfully. View the analytics dashboard now.'
          : 'Your data is being processed in the background...'}
      </Text>

      <Group justify="center" gap="md">
        <Button variant="light" color="indigo" leftSection={<IconUpload size={18} />} onClick={handleReset} className="hover:bg-indigo-50 transition-all border border-indigo-100">Upload Another</Button>
        {uploadId && (
          <Button
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-6 py-2 rounded-xl shadow-md shadow-indigo-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
            leftSection={<IconChartBar size={18} />}
            onClick={() => navigate(`/analytics?uploadId=${uploadId}`)}
            loading={!processingComplete}
          >
            View Analytics
          </Button>
        )}
      </Group>
    </MotionDiv>
  );

  return (
    <div className="max-w-5xl mx-auto py-6 animate-fade-in">
      <PageHeader 
        title="Smart Data Upload"
        subtitle="Universal Dropzone — intelligent routing and background processing"
      />

      <Tabs defaultValue="excel" mt="lg" className="w-full">
        <Tabs.List className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 mb-6 max-w-md">
          <Tabs.Tab value="excel" leftSection={<IconFileSpreadsheet size={16} />} className="flex-1 text-center py-2.5 rounded-lg font-semibold transition-all">
            Smart Upload
          </Tabs.Tab>
          <Tabs.Tab value="manual" leftSection={<IconKeyboard size={16} />} className="flex-1 text-center py-2.5 rounded-lg font-semibold transition-all">
            Manual Entry
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="excel">
          <Card className="border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm p-8 rounded-2xl mt-4">
            <AnimatePresence mode="wait">
              {step === 'drop' && renderDropZone()}
              {step === 'analyzing' && renderAnalyzing()}
              {step === 'complete' && renderComplete()}
            </AnimatePresence>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="manual">
          <Card className="border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm p-8 rounded-2xl mt-4">
            <Stack gap="md">
              <Text fw={800} className="text-slate-800 text-lg border-b border-slate-100 pb-2">Manual Data Entry</Text>
              <Group grow>
                <Select label="Select Doctor" placeholder="Search doctor" searchable required
                  data={doctors.map(d => ({ value: String(d.id), label: d.name }))}
                  value={manualEntry.doctorId}
                  onChange={(v) => setManualEntry(prev => ({ ...prev, doctorId: v || '' }))} />
                <Select label="Select Pharmacy" placeholder="Search pharmacy" searchable required
                  data={pharmacies.map(p => ({ value: String(p.id), label: p.name }))}
                  value={manualEntry.pharmacyId}
                  onChange={(v) => setManualEntry(prev => ({ ...prev, pharmacyId: v || '' }))} />
              </Group>
              <Group grow>
                <TextInput label="Product Name" placeholder="Enter product name" required
                  value={manualEntry.productName}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, productName: e.currentTarget.value }))} />
                <NumberInput label="Amount" placeholder="Sales amount" required min={0}
                  value={manualEntry.amount}
                  onChange={(v) => setManualEntry(prev => ({ ...prev, amount: String(v || '') }))} />
              </Group>
              <DateInput label="Date of Sale" required value={manualEntry.date}
                onChange={(d: any) => setManualEntry(prev => ({ ...prev, date: d ? new Date(d) : new Date() }))}
                leftSection={<IconCalendar size={16} />} />
              <Group justify="flex-end" mt="md">
                <Button 
                  onClick={handleManualSubmit} 
                  loading={savingManual} 
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-6 py-2 rounded-xl shadow-md shadow-indigo-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  leftSection={<IconKeyboard size={18} />}
                >
                  Save Entry
                </Button>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
