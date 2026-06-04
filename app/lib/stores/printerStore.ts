/**
 * Global printer state management using Zustand
 * Manages selected printer, connection status, print queue, and printer discovery
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DiscoveredPrinter {
  id: string;
  name: string;
  address: string;
  connectionMethod: 'wifi' | 'usb' | 'bluetooth';
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string;
  driverInfo?: {
    manufacturer: string;
    model: string;
    serialNumber?: string;
  };
}

export interface PrinterState {
  // Selected printer
  selectedPrinter: DiscoveredPrinter | null;
  defaultPrinterId: string | null;

  // Available printers
  discoveredPrinters: DiscoveredPrinter[];
  isDiscovering: boolean;

  // Connection status
  isConnected: boolean;
  connectionError: string | null;

  // Print queue
  printQueue: PrintJob[];
  isPrinting: boolean;
  lastPrintedAt: string | null;

  // UI state
  showPrinterSelector: boolean;
  showPrintQueue: boolean;

  // History
  printHistory: PrintJob[];
}

export interface PrintJob {
  id: string;
  zpl: string;
  title: string;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  completedAt?: string;
  printerId: string;
}

export interface PrinterStoreActions {
  // Printer selection
  setSelectedPrinter: (printer: DiscoveredPrinter | null) => void;
  setDefaultPrinter: (printerId: string) => void;

  // Discovery
  setDiscoveredPrinters: (printers: DiscoveredPrinter[]) => void;
  addDiscoveredPrinter: (printer: DiscoveredPrinter) => void;
  updatePrinterStatus: (printerId: string, status: 'online' | 'offline' | 'unknown') => void;
  setIsDiscovering: (discovering: boolean) => void;

  // Connection
  setIsConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;

  // Print queue
  addPrintJob: (job: PrintJob) => void;
  updatePrintJob: (jobId: string, updates: Partial<PrintJob>) => void;
  removePrintJob: (jobId: string) => void;
  clearPrintQueue: () => void;
  setIsPrinting: (printing: boolean) => void;

  // UI
  togglePrinterSelector: () => void;
  togglePrintQueue: () => void;

  // History
  addToPrintHistory: (job: PrintJob) => void;
  clearPrintHistory: () => void;

  // Reset
  reset: () => void;
}

const initialState: PrinterState = {
  selectedPrinter: null,
  defaultPrinterId: null,
  discoveredPrinters: [],
  isDiscovering: false,
  isConnected: false,
  connectionError: null,
  printQueue: [],
  isPrinting: false,
  lastPrintedAt: null,
  showPrinterSelector: false,
  showPrintQueue: false,
  printHistory: [],
};

export const usePrinterStore = create<PrinterState & PrinterStoreActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Printer selection
      setSelectedPrinter: (printer) =>
        set({
          selectedPrinter: printer,
          connectionError: null,
        }),

      setDefaultPrinter: (printerId) =>
        set({ defaultPrinterId: printerId }),

      // Discovery
      setDiscoveredPrinters: (printers) =>
        set({ discoveredPrinters: printers }),

      addDiscoveredPrinter: (printer) =>
        set((state) => {
          const exists = state.discoveredPrinters.some((p) => p.id === printer.id);
          if (exists) return state;
          return {
            discoveredPrinters: [...state.discoveredPrinters, printer],
          };
        }),

      updatePrinterStatus: (printerId, status) =>
        set((state) => ({
          discoveredPrinters: state.discoveredPrinters.map((p) =>
            p.id === printerId ? { ...p, status, lastSeen: new Date().toISOString() } : p
          ),
        })),

      setIsDiscovering: (discovering) =>
        set({ isDiscovering: discovering }),

      // Connection
      setIsConnected: (connected) =>
        set({ isConnected: connected }),

      setConnectionError: (error) =>
        set({ connectionError: error }),

      // Print queue
      addPrintJob: (job) =>
        set((state) => ({
          printQueue: [...state.printQueue, job],
        })),

      updatePrintJob: (jobId, updates) =>
        set((state) => ({
          printQueue: state.printQueue.map((job) =>
            job.id === jobId ? { ...job, ...updates } : job
          ),
        })),

      removePrintJob: (jobId) =>
        set((state) => ({
          printQueue: state.printQueue.filter((job) => job.id !== jobId),
        })),

      clearPrintQueue: () =>
        set({ printQueue: [] }),

      setIsPrinting: (printing) =>
        set({ isPrinting: printing }),

      // UI
      togglePrinterSelector: () =>
        set((state) => ({
          showPrinterSelector: !state.showPrinterSelector,
        })),

      togglePrintQueue: () =>
        set((state) => ({
          showPrintQueue: !state.showPrintQueue,
        })),

      // History
      addToPrintHistory: (job) =>
        set((state) => ({
          printHistory: [job, ...state.printHistory].slice(0, 100),
          lastPrintedAt: new Date().toISOString(),
        })),

      clearPrintHistory: () =>
        set({ printHistory: [] }),

      // Reset
      reset: () =>
        set(initialState),
    }),
    {
      name: 'printer-store',
      partialize: (state) => ({
        defaultPrinterId: state.defaultPrinterId,
        selectedPrinter: state.selectedPrinter,
        discoveredPrinters: state.discoveredPrinters,
        printHistory: state.printHistory.slice(0, 50),
      }),
    }
  )
);

// Selectors
export const usePrinterSelector = () => usePrinterStore((state) => state.selectedPrinter);
export const useDefaultPrinter = () => usePrinterStore((state) => state.defaultPrinterId);
export const useDiscoveredPrinters = () => usePrinterStore((state) => state.discoveredPrinters);
export const useIsConnected = () => usePrinterStore((state) => state.isConnected);
export const usePrintQueue = () => usePrinterStore((state) => state.printQueue);
export const useIsPrinting = () => usePrinterStore((state) => state.isPrinting);
export const usePrintHistory = () => usePrinterStore((state) => state.printHistory);
export const useConnectionError = () => usePrinterStore((state) => state.connectionError);
