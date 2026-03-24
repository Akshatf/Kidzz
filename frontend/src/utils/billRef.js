/**
 * Customer-facing bill reference: DDMMYYYY + sequence (not the internal DB id alone).
 * @param {string} saleDate - YYYY-MM-DD (expected in IST/Asia timezone)
 * @param {number} id - internal sale id
 */
export function formatBillRef(saleDate, id) {
  // Parse the date as IST (Indian Standard Time)
  // Split the date string and create date with IST timezone
  const [year, month, day] = saleDate.split('-');
  
  // Create date in IST (UTC+5:30)
  // Using UTC to avoid local timezone shifts
  const date = new Date(Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    0, 0, 0
  ));
  
  if (Number.isNaN(date.getTime())) {
    return `REF-${String(id).padStart(4, '0')}`;
  }
  
  // Format as DDMMYYYY in IST
  const dd = String(parseInt(day, 10)).padStart(2, '0');
  const mm = String(parseInt(month, 10)).padStart(2, '0');
  const yyyy = year;
  
  return `${dd}${mm}${yyyy}${String(id).padStart(4, '0')}`;
}

/**
 * Alternative: Format bill reference with explicit IST handling
 * @param {string|Date} dateInput - Date in YYYY-MM-DD format or Date object
 * @param {number} id - internal sale id
 */
export function formatBillRefIST(dateInput, id) {
  let year, month, day;
  
  if (typeof dateInput === 'string') {
    [year, month, day] = dateInput.split('-');
  } else if (dateInput instanceof Date) {
    // Convert to IST offset
    const istDate = new Date(dateInput.getTime() + (5.5 * 60 * 60 * 1000));
    year = istDate.getUTCFullYear();
    month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    day = String(istDate.getUTCDate()).padStart(2, '0');
  } else {
    return `REF-${String(id).padStart(4, '0')}`;
  }
  
  // Validate date parts
  if (!year || !month || !day) {
    return `REF-${String(id).padStart(4, '0')}`;
  }
  
  const dd = String(parseInt(day, 10)).padStart(2, '0');
  const mm = String(parseInt(month, 10)).padStart(2, '0');
  const yyyy = year;
  
  return `${dd}${mm}${yyyy}${String(id).padStart(4, '0')}`;
}

/**
 * Get current date in IST format (YYYY-MM-DD)
 */
export function getCurrentDateIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istDate = new Date(now.getTime() + istOffset);
  
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display in IST (DD/MM/YYYY)
 */
export function formatDateIST(dateStr) {
  if (!dateStr) return 'N/A';
  
  let year, month, day;
  
  if (dateStr.includes('-')) {
    [year, month, day] = dateStr.split('-');
  } else if (dateStr.includes('/')) {
    [day, month, year] = dateStr.split('/');
    return `${day}/${month}/${year}`;
  } else {
    return dateStr;
  }
  
  return `${day}/${month}/${year}`;
}

/**
 * Parse IST date string (DD/MM/YYYY) to YYYY-MM-DD for API
 */
export function parseDateForAPI(dateStr) {
  if (!dateStr) return '';
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}