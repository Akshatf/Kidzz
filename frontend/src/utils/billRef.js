/**
 * Customer-facing bill reference: DDMMYYYY + sequence (not the internal DB id alone).
 * @param {string} saleDate - YYYY-MM-DD
 * @param {number} id - internal sale id
 */
export function formatBillRef(saleDate, id) {
  const d = new Date(`${saleDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return `REF-${String(id).padStart(4, '0')}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}-${String(id).padStart(4, '0')}`;
}
