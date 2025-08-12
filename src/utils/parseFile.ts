// src/utils/parseFile.ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Helper function to parse phase formats
const parsePhases = (phaseString: string): number[] => {
  if (!phaseString) return [];
  
  const cleaned = phaseString.toString().trim();
  
  // Handle array format: [1,2,3] or "[1,2,3]"
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed.filter(n => Number.isInteger(n)) : [];
    } catch {
      const numbers = cleaned.match(/\d+/g);
      return numbers ? numbers.map(n => parseInt(n)).filter(n => !isNaN(n)) : [];
    }
  }
  
  // Handle range format: "1-3" or "2 - 5"
  const rangeMatch = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    const phases = [];
    for (let i = start; i <= end; i++) {
      phases.push(i);
    }
    return phases;
  }
  
  // Handle single number
  const singleNumber = parseInt(cleaned);
  if (!isNaN(singleNumber)) {
    return [singleNumber];
  }
  
  // Handle comma-separated: "1,2,3"
  const commaSeparated = cleaned.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  if (commaSeparated.length > 0) {
    return commaSeparated;
  }
  
  return [];
};

// Helper function to parse skills
const parseSkills = (skillString: string): string[] => {
  if (!skillString) return [];
  return skillString.toString().split(',').map(s => s.trim()).filter(s => s.length > 0);
};

// Helper function to normalize data after parsing
const normalizeRowData = (row: any, entityType?: string): any => {
  const normalized = { ...row };
  
  // Handle different entity types
  if (entityType === 'tasks' || row.TaskID) {
    if (row.PreferredPhases) {
      normalized.PreferredPhases = JSON.stringify(parsePhases(row.PreferredPhases));
    }
    if (row.RequiredSkills) {
      normalized.RequiredSkills = parseSkills(row.RequiredSkills).join(',');
    }
    if (row.Duration) {
      normalized.Duration = parseInt(row.Duration) || 0;
    }
    if (row.MaxConcurrent) {
      normalized.MaxConcurrent = parseInt(row.MaxConcurrent) || 1;
    }
  }
  
  if (entityType === 'workers' || row.WorkerID) {
    if (row.AvailableSlots) {
      normalized.AvailableSlots = JSON.stringify(parsePhases(row.AvailableSlots));
    }
    if (row.Skills) {
      normalized.Skills = parseSkills(row.Skills).join(',');
    }
    if (row.MaxLoadPerPhase) {
      normalized.MaxLoadPerPhase = parseInt(row.MaxLoadPerPhase) || 1;
    }
    if (row.QualificationLevel) {
      normalized.QualificationLevel = parseInt(row.QualificationLevel) || 1;
    }
  }
  
  if (entityType === 'clients' || row.ClientID) {
    if (row.PriorityLevel) {
      normalized.PriorityLevel = parseInt(row.PriorityLevel) || 1;
    }
    if (row.RequestedTaskIDs) {
      normalized.RequestedTaskIDs = row.RequestedTaskIDs.toString().trim();
    }
  }
  
  return normalized;
};

// Function to detect data type based on filename or headers
const detectDataType = (filename: string, headers: string[]): 'clients' | 'workers' | 'tasks' | null => {
  const name = filename.toLowerCase();
  
  // Check filename first
  if (name.includes('client')) return 'clients';
  if (name.includes('worker')) return 'workers';  
  if (name.includes('task')) return 'tasks';
  
  // Check headers
  if (headers.includes('ClientID') || headers.includes('ClientName')) return 'clients';
  if (headers.includes('WorkerID') || headers.includes('WorkerName')) return 'workers';
  if (headers.includes('TaskID') || headers.includes('TaskName')) return 'tasks';
  
  return null;
};

// Function to detect sheet type based on headers or sheet name
const detectSheetType = (sheetName: string, headers: string[]): 'clients' | 'workers' | 'tasks' | null => {
  const name = sheetName.toLowerCase();
  
  // Check sheet name first
  if (name.includes('client')) return 'clients';
  if (name.includes('worker')) return 'workers';
  if (name.includes('task')) return 'tasks';
  
  // Check headers
  if (headers.includes('ClientID') || headers.includes('ClientName')) return 'clients';
  if (headers.includes('WorkerID') || headers.includes('WorkerName')) return 'workers';
  if (headers.includes('TaskID') || headers.includes('TaskName')) return 'tasks';
  
  return null;
};

// Interface for parsed data
export interface ParsedData {
  clients: any[];
  workers: any[];
  tasks: any[];
  errors: string[];
}

// NEW: Function to parse multi-sheet Excel file
export const parseMultiSheetExcel = (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const result: ParsedData = {
          clients: [],
          workers: [],
          tasks: [],
          errors: []
        };
        
        console.log('Sheet names found:', workbook.SheetNames);
        
        // Process each sheet
        workbook.SheetNames.forEach(sheetName => {
          try {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              defval: ''
            });
            
            if (jsonData.length === 0) {
              result.errors.push(`Sheet "${sheetName}" is empty`);
              return;
            }
            
            // Get headers and detect type
            const headers = (jsonData[0] as string[]).map(h => h.toString().trim());
            const sheetType = detectSheetType(sheetName, headers);
            
            if (!sheetType) {
              result.errors.push(`Could not detect data type for sheet "${sheetName}"`);
              return;
            }
            
            // Convert rows to objects
            const rows = jsonData.slice(1);
            const objects = rows.map(row => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = (row as any[])[index] || '';
              });
              return normalizeRowData(obj, sheetType);
            }).filter(row => {
              // Filter out empty rows
              const requiredField = sheetType === 'clients' ? 'ClientID' : 
                                   sheetType === 'workers' ? 'WorkerID' : 'TaskID';
              return row[requiredField] && row[requiredField].toString().trim();
            });
            
            // Assign to correct array
            result[sheetType] = objects;
            console.log(`Parsed ${sheetType} from "${sheetName}":`, objects.length, 'records');
            
          } catch (error) {
            result.errors.push(`Error parsing sheet "${sheetName}": ${error}`);
          }
        });
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// NEW: Function to parse single CSV file
export const parseSingleCSV = (file: File): Promise<{ data: any[], type: 'clients' | 'workers' | 'tasks' | null }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        try {
          if (results.data.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }
          
          const headers = Object.keys(results.data[0]);
          const dataType = detectDataType(file.name, headers);
          
          if (!dataType) {
            reject(new Error('Could not detect data type. Ensure filename contains "client", "worker", or "task", or has proper headers.'));
            return;
          }
          
          const normalizedData = results.data.map(row => normalizeRowData(row, dataType));
          
          console.log(`CSV parsed (${dataType}):`, normalizedData.length, 'records');
          resolve({ data: normalizedData, type: dataType });
        } catch (error) {
          reject(error);
        }
      },
      error: (err) => reject(err),
    });
  });
};

// Main function to handle any file type
export const parseAnyFile = (file: File): Promise<ParsedData> => {
  return new Promise(async (resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'xlsx' || ext === 'xls') {
      // Handle Excel file with multiple sheets
      try {
        const result = await parseMultiSheetExcel(file);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    } else if (ext === 'csv') {
      // Handle single CSV file
      try {
        const csvResult = await parseSingleCSV(file);
        const result: ParsedData = {
          clients: [],
          workers: [],
          tasks: [],
          errors: []
        };
        
        if (csvResult.type) {
          result[csvResult.type] = csvResult.data;
        } else {
          result.errors.push('Could not determine CSV data type');
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    } else {
      reject(new Error('Unsupported file format. Please use CSV or Excel files.'));
    }
  });
};
