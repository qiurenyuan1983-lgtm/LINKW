
import { GoogleGenAI, Type, FunctionDeclaration, Tool, SchemaType } from "@google/genai";
import { LocationRule, ExceptionEntry, LogEntry } from '../types';

// Tool Definitions

// 1. Overview Tool
const getWarehouseOverviewTool: FunctionDeclaration = {
  name: 'get_warehouse_overview',
  description: 'Get high-level statistics about the warehouse, including utilization and total capacity.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

// 2. Find Locations Tool
const findLocationsTool: FunctionDeclaration = {
  name: 'find_locations',
  description: 'Find warehouse locations based on status (empty/partial/full) or specific destination tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: 'Filter by status: "empty", "partial", "full".',
      },
      destination: {
        type: Type.STRING,
        description: 'Filter by destination tag (e.g., "XLX7", "Shein").',
      },
      limit: {
        type: Type.NUMBER,
        description: 'Maximum number of results to return (default 10).',
      }
    },
  },
};

// 3. Location Details Tool
const getLocationDetailsTool: FunctionDeclaration = {
  name: 'get_location_details',
  description: 'Get detailed information about a specific location code (e.g., "A01").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      locationCode: {
        type: Type.STRING,
        description: 'The location code to look up.',
      }
    },
    required: ['locationCode'],
  },
};

// 4. Report Exception Tool (NEW)
const reportExceptionTool: FunctionDeclaration = {
  name: 'report_exception',
  description: 'Record a warehouse anomaly or exception (e.g., damaged cargo, missing label).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      containerNo: { type: Type.STRING, description: 'Container number (optional).' },
      pcNo: { type: Type.STRING, description: 'PC/Shipment number (optional).' },
      description: { type: Type.STRING, description: 'Detailed description of the issue.' },
    },
    required: ['description'],
  },
};

const warehouseTools: Tool[] = [
    { functionDeclarations: [getWarehouseOverviewTool, findLocationsTool, getLocationDetailsTool, reportExceptionTool] }
];

const SYSTEM_INSTRUCTION = `You are "Mike", an expert warehouse management assistant for the LinkW system (盈仓科技).
Your capabilities include:
1. **Inventory Management**: Checking stock, finding empty slots, and analyzing capacity.
2. **File Processing**: The user may upload CSV, TXT, or Excel (as CSV) files containing Unload Plans or Outbound Orders. You must parse this text data to answer questions about incoming/outgoing stock.
3. **Image Recognition**: The user may upload photos of shelves, cargo, or labels. You must analyze these for:
   - Reading blurred labels.
   - Identifying damaged goods.
   - Checking stacking compliance (e.g., "Is this unsafe?").
4. **Exception Handling**: If a user reports damage or an issue, use the 'report_exception' tool to log it in the system immediately.

GUIDELINES:
- **Language**: Detect the user's language. If Chinese, reply in Chinese. If English, reply in English.
- **Data First**: Use tools to fetch real-time data. Do not guess.
- **Safety**: If analyzing an image of cargo, prioritize safety checks (leaning stacks, crushed boxes).
- **Conciseness**: Be fast and professional. Use Markdown for lists.
`;

export interface AssistantActions {
    addException: (entry: Omit<ExceptionEntry, 'id' | 'time'>) => void;
}

export class WarehouseAssistant {
  private ai: GoogleGenAI;
  private chat: any;
  private rules: LocationRule[] = [];
  private logs: LogEntry[] = [];
  private actions: AssistantActions | null = null;

  constructor() {
    const apiKey = process.env.API_KEY;
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
    
    this.chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: warehouseTools,
        temperature: 0.2,
      },
    });
  }

  public updateContext(rules: LocationRule[], logs: LogEntry[], actions: AssistantActions) {
    this.rules = rules;
    this.logs = logs;
    this.actions = actions;
  }

  public async analyzeLabelImage(base64Data: string): Promise<{ destination?: string, containerNo?: string, cartons?: number }> {
      try {
          const response = await this.ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                  parts: [
                      { text: "Identify the Destination code (e.g., CLT2, XLX7, GYR3), Container Number (4 letters + 7 digits), and Item/Carton Count from this shipping label." },
                      { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                  ]
              },
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          destination: { type: Type.STRING, description: "The destination code (e.g., CLT2, XLX7, GYR3). Usually 3-4 uppercase letters followed by a number. Often boxed." },
                          containerNo: { type: Type.STRING, description: "The container number (e.g., OOLU1234567). Standard format is 4 letters + 7 digits." },
                          cartons: { type: Type.NUMBER, description: "The quantity or piece count (e.g., QTY: 32). Extract the number." }
                      }
                  }
              }
          });

          const text = response.text;
          if (!text) return {};
          
          return JSON.parse(text);
      } catch (e) {
          console.error("Label analysis failed", e);
          return {};
      }
  }

  public async sendMessage(message: string, fileData?: { mimeType: string, data: string }): Promise<string> {
    if (!process.env.API_KEY) {
        return "Error: Gemini API Key is missing.";
    }

    try {
      let messageContent: any = message;

      if (fileData) {
          // If it's a text-based file (CSV, TXT, JSON), append it as text context
          if (fileData.mimeType.startsWith('text/') || fileData.mimeType === 'application/json' || fileData.mimeType === 'text/csv') {
              const binaryString = atob(fileData.data);
              // Handle potential unicode issues in simple b64 decode if necessary, 
              // but for this snippet we assume standard text.
              const decodedText = binaryString; // Simplified for this context
              
              messageContent = `${message}\n\n[Attached File Content]:\n${decodedText}`;
          } else {
              // Image or PDF
              messageContent = [
                  { text: message },
                  { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
              ];
          }
      }

      let response = await this.chat.sendMessage({ message: messageContent });
      
      // Loop for tool calls
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = response.functionCalls.map((call: any) => {
          const result = this.executeFunction(call.name, call.args);
          return {
            functionResponse: {
                id: call.id,
                name: call.name,
                response: { result: result }
            }
          };
        });

        response = await this.chat.sendMessage({ message: functionResponses });
      }

      return response.text || "I processed that, but I have nothing to say.";
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      return `Sorry, I encountered an error: ${error.message}`;
    }
  }

  private executeFunction(name: string, args: any): any {
    console.log(`Executing tool: ${name}`, args);
    switch (name) {
      case 'get_warehouse_overview':
        return this.getOverview();
      case 'find_locations':
        return this.findLocations(args.status, args.destination, args.limit);
      case 'get_location_details':
        return this.getLocationDetails(args.locationCode);
      case 'report_exception':
        return this.reportException(args);
      default:
        return { error: `Function ${name} not found.` };
    }
  }

  // --- Tool Implementations ---

  private getOverview() {
    const total = this.rules.length;
    const used = this.rules.filter(r => (r.curPallet || 0) > 0).length;
    const totalPallets = this.rules.reduce((acc, r) => acc + (r.curPallet || 0), 0);
    const totalCapacity = this.rules.reduce((acc, r) => acc + (r.maxPallet || 0), 0);
    const utilization = totalCapacity > 0 ? Math.round((totalPallets / totalCapacity) * 100) : 0;
    
    // Group by Zone
    const zones: Record<string, number> = {};
    this.rules.forEach(r => {
        const z = r.range.charAt(0);
        if (!zones[z]) zones[z] = 0;
        zones[z] += (r.curPallet || 0);
    });

    return {
      totalLocations: total,
      locationsWithStock: used,
      totalPallets,
      totalCapacity,
      utilizationPercentage: utilization,
      zoneBreakdown: zones,
      recentLogs: this.logs.slice(0, 3) // Give a bit of recent context
    };
  }

  private findLocations(status?: string, destination?: string, limit: number = 10) {
    let matches = this.rules;

    if (status) {
      if (status === 'empty') matches = matches.filter(r => (r.curPallet || 0) === 0);
      else if (status === 'full') matches = matches.filter(r => (r.curPallet || 0) >= (r.maxPallet || 0));
      else if (status === 'partial') matches = matches.filter(r => (r.curPallet || 0) > 0 && (r.curPallet || 0) < (r.maxPallet || 0));
    }

    if (destination) {
      const searchDest = destination.toLowerCase();
      matches = matches.filter(r => r.destinations?.toLowerCase().includes(searchDest));
    }

    matches = matches.slice(0, limit);

    return matches.map(r => ({
      location: r.range,
      pallets: r.curPallet || 0,
      max: r.maxPallet || 0,
      destinations: r.destinations,
      type: r.type
    }));
  }

  private getLocationDetails(code: string) {
    const rule = this.rules.find(r => r.range.toUpperCase() === code.toUpperCase());
    if (!rule) return { error: `Location ${code} not found.` };
    return rule;
  }

  private reportException(args: any) {
      if (this.actions) {
          this.actions.addException({
              containerNo: args.containerNo || 'Unknown',
              pcNo: args.pcNo || '',
              description: args.description,
              photos: [] // AI-reported exceptions via text tool don't have photos yet
          });
          return { success: true, message: "Exception recorded in system." };
      }
      return { error: "System actions not initialized." };
  }
}
