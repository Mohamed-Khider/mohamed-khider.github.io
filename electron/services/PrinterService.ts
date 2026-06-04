/**
 * Background Printer Service
 * Runs as a separate Node.js process
 * Manages printer discovery, connection, and ZPL communication
 */
import net from 'net';
import os from 'os';
import { EventEmitter } from 'events';

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

export interface PrintResult {
  success: boolean;
  jobId: string;
  message: string;
  timestamp: string;
}

export class PrinterService extends EventEmitter {
  private printerConnections: Map<string, net.Socket> = new Map();
  private printQueue: Array<{
    jobId: string;
    printerId: string;
    zpl: string;
    retry: number;
  }> = [];
  private isProcessing = false;
  private discoveredPrinters: Map<string, DiscoveredPrinter> = new Map();

  constructor() {
    super();
    this.initializeService();
  }

  private initializeService() {
    console.log('[PrinterService] Initializing background printer service');
    
    // Start printer discovery
    this.startPrinterDiscovery();
    
    // Start print queue processor
    this.startQueueProcessor();
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Discover network Zebra printers
   */
  private startPrinterDiscovery() {
    setInterval(async () => {
      await this.discoverNetworkPrinters();
    }, 30000); // Every 30 seconds

    // Initial discovery
    this.discoverNetworkPrinters();
  }

  private async discoverNetworkPrinters() {
    console.log('[PrinterService] Discovering network printers...');
    
    try {
      const commonPrinterIPs = this.generateLocalSubnetIPs();
      const foundPrinters: DiscoveredPrinter[] = [];

      // Check common Zebra printer ports
      for (const ip of commonPrinterIPs) {
        try {
          const isReachable = await this.checkPrinterAtIP(ip, 9100);
          if (isReachable) {
            const printer: DiscoveredPrinter = {
              id: `zebra-${ip}`,
              name: `Zebra Printer (${ip})`,
              address: ip,
              connectionMethod: 'wifi',
              status: 'online',
              lastSeen: new Date().toISOString(),
              driverInfo: {
                manufacturer: 'Zebra Technologies',
                model: 'Network Printer',
              },
            };
            foundPrinters.push(printer);
            this.discoveredPrinters.set(printer.id, printer);
          }
        } catch (error) {
          // Printer not found at this IP
        }
      }

      if (foundPrinters.length > 0) {
        this.emit('printers-discovered', foundPrinters);
      }
    } catch (error) {
      console.error('[PrinterService] Discovery error:', error);
    }
  }

  private generateLocalSubnetIPs(): string[] {
    const localIPs = this.getLocalIPAddresses();
    const ips: string[] = [];

    for (const ip of localIPs) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        // Check common printer ranges (typically .100-.150)
        for (let i = 100; i <= 150; i++) {
          ips.push(`${subnet}.${i}`);
        }
      }
    }

    return ips;
  }

  private getLocalIPAddresses(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (netInterface) {
        for (const addr of netInterface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            ips.push(addr.address);
          }
        }
      }
    }

    return ips;
  }

  private checkPrinterAtIP(ip: string, port: number, timeout = 500): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, ip, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Send ZPL to printer
   */
  async sendZPL(printerId: string, zpl: string, timeout = 5000): Promise<PrintResult> {
    return new Promise((resolve, reject) => {
      const printer = this.discoveredPrinters.get(printerId);
      
      if (!printer) {
        reject(new Error(`Printer not found: ${printerId}`));
        return;
      }

      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('Print operation timed out'));
      }, timeout);

      socket.on('connect', () => {
        socket.write(zpl, (err) => {
          clearTimeout(timer);
          if (err) {
            socket.destroy();
            reject(err);
          } else {
            socket.end(() => {
              resolve({
                success: true,
                jobId: `${printerId}-${Date.now()}`,
                message: 'ZPL sent successfully',
                timestamp: new Date().toISOString(),
              });
            });
          }
        });
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      socket.connect(9100, printer.address);
    });
  }

  /**
   * Queue a print job
   */
  queuePrintJob(printerId: string, zpl: string, jobId: string) {
    this.printQueue.push({
      jobId,
      printerId,
      zpl,
      retry: 0,
    });

    this.emit('job-queued', { jobId, printerId });
    
    // Process immediately if not busy
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process print queue
   */
  private async startQueueProcessor() {
    setInterval(() => {
      if (!this.isProcessing && this.printQueue.length > 0) {
        this.processQueue();
      }
    }, 1000);
  }

  private async processQueue() {
    if (this.isProcessing || this.printQueue.length === 0) return;

    this.isProcessing = true;
    const job = this.printQueue.shift();

    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      const result = await this.sendZPL(job.printerId, job.zpl);
      this.emit('job-completed', {
        jobId: job.jobId,
        printerId: job.printerId,
        success: true,
        result,
      });
    } catch (error) {
      job.retry++;

      if (job.retry < 3) {
        // Retry
        this.printQueue.push(job);
        this.emit('job-retry', {
          jobId: job.jobId,
          retry: job.retry,
          error: String(error),
        });
      } else {
        // Failed after retries
        this.emit('job-failed', {
          jobId: job.jobId,
          printerId: job.printerId,
          error: String(error),
        });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get discovered printers
   */
  getPrinters(): DiscoveredPrinter[] {
    return Array.from(this.discoveredPrinters.values());
  }

  /**
   * Check printer connectivity
   */
  async testConnection(printerId: string): Promise<boolean> {
    const printer = this.discoveredPrinters.get(printerId);
    if (!printer) return false;

    return this.checkPrinterAtIP(printer.address, 9100, 2000);
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queued: this.printQueue.length,
      isProcessing: this.isProcessing,
      queue: this.printQueue,
    };
  }

  /**
   * Shutdown service
   */
  private shutdown() {
    console.log('[PrinterService] Shutting down...');
    
    // Close all connections
    for (const socket of this.printerConnections.values()) {
      socket.destroy();
    }
    
    this.printerConnections.clear();
    process.exit(0);
  }
}

// Create and export singleton instance
export const printerService = new PrinterService();

// IPC/RPC message handler for Electron
export function handlePrinterServiceMessage(message: any) {
  const { type, data } = message;

  switch (type) {
    case 'get-printers':
      return { success: true, data: printerService.getPrinters() };

    case 'send-zpl':
      printerService.queuePrintJob(data.printerId, data.zpl, data.jobId);
      return { success: true, message: 'Job queued' };

    case 'test-connection':
      return printerService.testConnection(data.printerId);

    case 'queue-status':
      return { success: true, data: printerService.getQueueStatus() };

    default:
      return { success: false, error: 'Unknown command' };
  }
}
