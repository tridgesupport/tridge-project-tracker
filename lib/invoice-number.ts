// India's financial year runs April 1 – March 31.
export function fyCodeForDate(date: Date): string {
  const year = date.getFullYear()
  const startYear = date.getMonth() >= 3 ? year : year - 1 // month is 0-indexed; 3 = April
  const endYear = startYear + 1
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`
}

// Matches the historical 7-character style ({fy}{client#}{seq}), e.g. "2627205".
export function formatInvoiceNumber({
  fyCode,
  clientNumber,
  sequenceInFy,
}: {
  fyCode: string
  clientNumber: number
  sequenceInFy: number
}): string {
  return `${fyCode}${clientNumber}${String(sequenceInFy).padStart(2, '0')}`
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'ST', 2: 'ND', 3: 'RD' }
function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'TH'
  return ORDINAL_SUFFIXES[day % 10] || 'TH'
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function formatInvoiceDate(date: Date): string {
  const day = date.getDate()
  return `${day}${ordinalSuffix(day)} ${MONTH_NAMES[date.getMonth()].toUpperCase()} ${date.getFullYear()}`
}

export function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// The scheduled billing day for a given period: the 30th, or the last day of
// February (which has no 30th).
export function billingDateForPeriod(month: number, year: number): Date {
  if (month === 2) {
    return new Date(year, 2, 0) // day 0 of March = last day of February
  }
  return new Date(year, month - 1, 30)
}
