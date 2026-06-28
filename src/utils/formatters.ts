export function parseJsonFields(row: any): any {
  if (row == null || typeof row !== 'object') return row;

  Object.keys(row).forEach((key) => {
    const value = row[key];

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object') {
          row[key] = parsed;
        }
      } catch {}
    }
  });

  return row;
}

export function successResponse(data: any): { data: any } {
  return { data };
}

export function errorResponse(message: string): { error: { message: string } } {
  return { error: { message } };
}

export default { parseJsonFields, successResponse, errorResponse };
