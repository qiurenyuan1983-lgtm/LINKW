
export type UserRole = 'Mike' | 'operator' | 'staff' | 'stock_adj' | 'bulk_cargo' | null;

export interface Task {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
  priority?: 'high' | 'medium' | 'low';
}

export interface LocationRule {
  range: string;
  type: string;
  note: string;
  allowedDest: number | null;
  currentDest: number | null;
  destinations: string; // Comma separated string
  maxPallet: number | null;
  curPallet: number | null;
  curCartons: number | null;
  tasks?: Task[];
  containers?: Record<string, number>; // ContainerNo -> Pallets in this location
}

export interface MoveSuggestion {
  id: string;
  source: string;
  target: string;
  dest: string;
  quantity: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LogEntry {
  time: string;
  text: string;
  location?: string; // For location-specific history
  containerNo?: string;
}

export interface ColumnConfig {
  id: keyof LocationRule | 'utilization' | 'status' | 'actions';
  label: string;
  order: number;
  visible: boolean;
}

export interface UnloadPlanRow {
  raw: any[];
  dest: string;
  pallets: number;
  rowIndex: number;
  containerNo: string;
  location?: string;
  // V14.1: Add specific fields for new export format
  so?: string;
  shippingMark?: string;
  cartons?: number;
  weight?: number;
  volume?: number;
  // V14.3: Support split assignments
  assignments?: { location: string; pallets: number; cartons: number }[];
}

export interface UnloadPlan {
  headers: string[];
  rows: UnloadPlanRow[];
  headerRowIndex: number;
  worksheet: any; // Keep original worksheet for formatting consistency
  workbook: any; // Keep original workbook for exact export
  sheetName: string; 
  containerNo: string;
  fileName?: string;
}

export interface OutboundRow {
    dest: string;
    pallets: number;
    cartons?: number;
    location?: string;
    containerNo?: string;
}

// FIX: Add ExceptionEntry type
export interface ExceptionEntry {
  id: string;
  time: string;
  containerNo?: string;
  pcNo?: string;
  description: string;
  photos?: string[]; // Base64 encoded images
}

// FIX: Add ChatMessage type for GeminiAssistant component
export interface ChatMessage {
  role: 'user' | 'model' | 'loading';
  content: string;
}

export interface ContainerStats {
  pallets: number;
  cartons: number;
}

// Maps a Destination to an object of Container Numbers and their stats
// e.g. { "Amazon-XLX7": { "MSCU1234": { pallets: 10, cartons: 500 } } }
export type DestContainerMap = Record<string, Record<string, ContainerStats>>;

export type Accounts = Record<string, { password: string; role: UserRole }>;

export interface CloudConfig {
    url: string;
    apiKey: string;
    autoSync?: boolean; // New field for auto-sync preference
}

export interface FullBackup {
    rules: LocationRule[];
    logs: LogEntry[];
    exceptions: ExceptionEntry[];
    destContainerMap: DestContainerMap;
    accounts: Accounts;
    version: string;
    timestamp: number;
    backupDate?: string; // Human readable
}

// --- COST CONTROL MODULE TYPES ---

export type VendorRating = 'A' | 'B' | 'C' | 'D';

export interface Vendor {
    id: string;
    name: string;
    type: 'supplies' | 'equipment' | 'maintenance' | 'service';
    contactName: string;
    contactPhone: string;
    rating: VendorRating;
    ratingReason?: string; // Why did they get this rating?
    status: 'active' | 'blacklisted';
}

export interface Asset {
    id: string;
    name: string;
    model: string;
    category: 'forklift' | 'packaging' | 'it' | 'automation' | 'furniture';
    location: string; // e.g., "Zone A"
    owner: string; // Person responsible
    purchaseDate: string;
    value: number; // Original value
    status: 'active' | 'maintenance' | 'retired';
    maintenanceCount: number; // For alert logic
}

export interface MaintenanceRecord {
    id: string;
    assetId: string;
    assetName: string;
    type: 'repair' | 'maintenance';
    description: string;
    cost: number;
    date: string;
    vendorId: string;
    isResolved: boolean;
}

export interface ProcurementRequest {
    id: string;
    itemName: string;
    category: 'consumable' | 'device' | 'part';
    quantity: number;
    estimatedCost: number;
    reason: string;
    requester: string;
    status: 'pending' | 'approved' | 'rejected' | 'ordered';
    date: string;
}

// ---------------------------------


// V14 Location Types
export const LOCATION_TYPES = [
  { value: "amz-main-A", label: "Amazon Main (A)", class: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "amz-main-BC", label: "Amazon Main (B/C)", class: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "amz-buffer", label: "Amazon Buffer (D/E/G)", class: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "sehin", label: "Shein Zone (A)", class: "bg-pink-50 text-pink-700 border-pink-200" },
  { value: "private", label: "Private (V/G)", class: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "platform", label: "Platform (F/H)", class: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "express", label: "Express (A)", class: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "suspense", label: "Suspense/Transfer", class: "bg-gray-50 text-gray-700 border-gray-200" },
  { value: "highvalue", label: "High Value (R)", class: "bg-red-50 text-red-700 border-red-200" },
];


export const DESTINATION_OPTIONS = [
  // Platform & Express
  "商业地址","希音仓","住宅地址","谷仓","万邑通","walmart","tiktok", "FedEx", "wayfair","西邮", "4px",
  // General
  "暂扣","大货中转","仓储上架", "运去哪",
  // Main Amazon
  "XLX7", "MIT2", "GYR2", "GEU3", "IUSW", "GEU2", "GYR3", "IND9", "IUTE", "CLT2", "FWA4", "SCK8", "ABE8", "SBD1", "MQJ1", "LGB8", "PSC2", "BNA6", "FTW1", "AVP1", "IUSP", "LAN2", "MEM1", "RMN3", "VGT2", "RFD2", "ABQ2", "IUSJ", "IAH3", "LAX9", "IUSR", "SCK4", "ONT8", "TCY1", "SLC2", "RDU4", "SMF3", "MDW2", "LAS1", "IUSQ", "ORF2", "FOE1", "TEB9", "GEU5", "DEN8", "POC1", "RDU2", "IUTI", "POC3",
  // Buffer Amazon
  "LGB6", "SWF2", "OKC2", "HLI2", "IUSF", "SMF6", "TCY2", "SBD2", "POC2", "AMA1", "IUST", "FAT2", "IND5", "PHX7", "QXY8", "MKC4", "SJC7", "PBI3", "PPO4", "ICT2", "MEM6", "STL3", "MCC1", "ILG1", "RYY2", "LAS6", "BOS7", "LGB4", "DFW6", "RIC7", "STL4", "SAT1", "FTW5", "MCE1", "OAK3", "LIT2", "LFT1", "XON1", "SAT4", "SLC3", "MDW6", "BFI3", "RFD4", "MQJ2",
];
