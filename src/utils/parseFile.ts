// src/utils/parseFile.ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Helper function to parse phase formats -> number[]
const parsePhases = (phaseString: string): number[] => {
  if (!phaseString) return [];
  const cleaned = phaseString.toString().trim();

  // Array format: [1,2,3]
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
    } catch {
      const numbers = cleaned.match(/\d+/g);
      return numbers ? numbers.map((n) => parseInt(n)).filter((n) => !isNaN(n)) : [];
    }
  }

  // Range format: "1-3"
  const rangeMatch = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    const phases: number[] = [];
    for (let i = start; i <= end; i++) phases.push(i);
    return phases;
  }

  // Single number
  const singleNumber = parseInt(cleaned);
  if (!isNaN(singleNumber)) return [singleNumber];

  // Comma separated: "1,2,3"
  const commaSeparated = cleaned
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));
  if (commaSeparated.length > 0) return commaSeparated;

  return [];
};

// Helper function to parse skills -> string[]
const parseSkills = (skillString: string): string[] => {
  if (!skillString) return [];
  return skillString
    .toString()
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

// 🔧 Minimal change: keep canonical columns as strings expected by validator,
// add parallel *Arr fields for the UI/logic. Keep numbers as numbers.
const normalizeRowData = (row: any, entityType?: string): any => {
  const normalized: any = { ...row };

  // TASKS
  if (entityType === 'tasks' || row.TaskID) {
    if (row.PreferredPhases !== undefined && row.PreferredPhases !== null) {
      const arr = parsePhases(row.PreferredPhases);
      normalized.PreferredPhasesArr = arr;              // helper for UI
      normalized.PreferredPhases = JSON.stringify(arr); // validator-friendly string
    }
    if (row.RequiredSkills !== undefined && row.RequiredSkills !== null) {
      const arr = parseSkills(row.RequiredSkills);
      normalized.RequiredSkillsArr = arr;
      normalized.RequiredSkills = arr.join(',');        // validator-friendly string
    }
    if (row.Duration !== undefined && row.Duration !== null) {
      const n = Number(row.Duration);
      normalized.Duration = Number.isFinite(n) ? n : 0;
    }
    if (row.MaxConcurrent !== undefined && row.MaxConcurrent !== null) {
      const n = Number(row.MaxConcurrent);
      normalized.MaxConcurrent = Number.isFinite(n) ? n : 1;
    }
    // Keep raw AttributesJSON string; add parsed helper if valid
    if (row.AttributesJSON !== undefined && row.AttributesJSON !== null) {
      const s = String(row.AttributesJSON).trim();
      normalized.AttributesJSON = s; // keep as-is so validator can detect broken JSON
      try {
        normalized.AttributesParsed = s ? JSON.parse(s) : null;
      } catch {
        normalized.AttributesParsed = null; // broken JSON remains detectable via raw string
      }
    }
  }

  // WORKERS
  if (entityType === 'workers' || row.WorkerID) {
    if (row.AvailableSlots !== undefined && row.AvailableSlots !== null) {
      const arr = parsePhases(row.AvailableSlots);
      normalized.AvailableSlotsArr = arr;
      normalized.AvailableSlots = JSON.stringify(arr);  // validator-friendly string
    }
    if (row.Skills !== undefined && row.Skills !== null) {
      const arr = parseSkills(row.Skills);
      normalized.SkillsArr = arr;
      normalized.Skills = arr.join(',');                // validator-friendly string
    }
    if (row.MaxLoadPerPhase !== undefined && row.MaxLoadPerPhase !== null) {
      const n = Number(row.MaxLoadPerPhase);
      normalized.MaxLoadPerPhase = Number.isFinite(n) ? n : 1;
    }
    if (row.qualificationlevel !== undefined && row.QualificationLevel === undefined) {
      // tolerate casing mishaps
      normalized.QualificationLevel = Number(row.qualificationlevel) || 1;
    } else if (row.QualificationLevel !== undefined && row.QualificationLevel !== null) {
      const n = Number(row.QualificationLevel);
      normalized.QualificationLevel = Number.isFinite(n) ? n : 1;
    }
  }

  // CLIENTS
  if (entityType === 'clients' || row.ClientID) {
    if (row.PriorityLevel !== undefined && row.PriorityLevel !== null) {
      const n = Number(row.PriorityLevel);
      normalized.PriorityLevel = Number.isFinite(n) ? n : 1;
    }
    if (row.RequestedTaskIDs !== undefined && row.RequestedTaskIDs !== null) {
      // Accept array or CSV, normalize BOTH: canonical string + helper array
      if (Array.isArray(row.RequestedTaskIDs)) {
        const arr = row.RequestedTaskIDs.map((x: any) => String(x).trim()).filter(Boolean);
        normalized.RequestedTaskIDsArr = arr;
        normalized.RequestedTaskIDs = arr.join(',');    // validator-friendly string
      } else {
        const arr = String(row.RequestedTaskIDs)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        normalized.RequestedTaskIDsArr = arr;
        normalized.RequestedTaskIDs = arr.join(',');    // canonical
      }
    }
  }

  return normalized;
};

// Case-insensitive header matching
const hasHeader = (headers: string[], needle: string) =>
  headers.map((h) => h.toLowerCase()).some((h) => h.includes(needle.toLowerCase()));

// Detect data type by filename or headers
const detectDataType = (
  filename: string,
  headers: string[]
): 'clients' | 'workers' | 'tasks' | null => {
  const name = filename.toLowerCase();
  if (name.includes('client')) return 'clients';
  if (name.includes('worker')) return 'workers';
  if (name.includes('task')) return 'tasks';

  if (hasHeader(headers, 'clientid') || hasHeader(headers, 'clientname')) return 'clients';
  if (hasHeader(headers, 'workerid') || hasHeader(headers, 'workername')) return 'workers';
  if (hasHeader(headers, 'taskid') || hasHeader(headers, 'taskname')) return 'tasks';

  return null;
};

// Detect sheet type by name/headers
const detectSheetType = (
  sheetName: string,
  headers: string[]
): 'clients' | 'workers' | 'tasks' | null => {
  const name = sheetName.toLowerCase();
  if (name.includes('client')) return 'clients';
  if (name.includes('worker')) return 'workers';
  if (name.includes('task')) return 'tasks';

  if (hasHeader(headers, 'clientid') || hasHeader(headers, 'clientname')) return 'clients';
  if (hasHeader(headers, 'workerid') || hasHeader(headers, 'workername')) return 'workers';
  if (hasHeader(headers, 'taskid') || hasHeader(headers, 'taskname')) return 'tasks';

  return null;
};

// Parsed data shape
export interface ParsedData {
  clients: any[];
  workers: any[];
  tasks: any[];
  errors: string[];
}

// Parse multi-sheet Excel (3 sheets or more)
export const parseMultiSheetExcel = (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const result: ParsedData = { clients: [], workers: [], tasks: [], errors: [] };

        workbook.SheetNames.forEach((sheetName) => {
          try {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (jsonData.length === 0) {
              result.errors.push(`Sheet "${sheetName}" is empty`);
              return;
            }

            const headers = (jsonData[0] as string[]).map((h) => h.toString().trim());
            const sheetType = detectSheetType(sheetName, headers);
            if (!sheetType) {
              result.errors.push(`Could not detect data type for sheet "${sheetName}"`);
              return;
            }

            const rows = jsonData.slice(1);
            const objects = rows
              .map((row) => {
                const obj: any = {};
                headers.forEach((header, index) => {
                  obj[header] = (row as any[])[index] ?? '';
                });
                return normalizeRowData(obj, sheetType);
              })
              .filter((row) => {
                const requiredField =
                  sheetType === 'clients' ? 'ClientID' : sheetType === 'workers' ? 'WorkerID' : 'TaskID';
                return row[requiredField] && row[requiredField].toString().trim();
              });

            (result as any)[sheetType] = objects;
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

// Parse single CSV
export const parseSingleCSV = (
  file: File
): Promise<{ data: Record<string, unknown>[]; type: 'clients' | 'workers' | 'tasks' | null }> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        try {
          const rows = results.data ?? [];
          if (rows.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }

          const first = rows[0];
          if (!first || typeof first !== 'object' || Array.isArray(first)) {
            reject(new Error('Unexpected CSV row format'));
            return;
          }

          const headers = Object.keys(first as Record<string, unknown>);
          const dataType = detectDataType(file.name, headers);
          if (!dataType) {
            reject(
              new Error(
                'Could not detect data type. Ensure filename contains "client", "worker", or "task", or has proper headers.'
              )
            );
            return;
          }

          const normalizedData = rows.map((row) => normalizeRowData(row, dataType));
          resolve({ data: normalizedData, type: dataType });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      error: (err) => reject(err instanceof Error ? err : new Error(String(err))),
    });
  });
};

// Main (CSV or Excel)
export const parseAnyFile = (file: File): Promise<ParsedData> => {
  return new Promise(async (resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const result = await parseMultiSheetExcel(file);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    } else if (ext === 'csv') {
      try {
        const csvResult = await parseSingleCSV(file);
        const result: ParsedData = { clients: [], workers: [], tasks: [], errors: [] };

        if (csvResult.type) {
          (result as any)[csvResult.type] = csvResult.data;
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
