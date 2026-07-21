import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/coach/CoachReport.tsx'),
  'utf8',
)

describe('CoachReport submission flow', () => {
  it('finishes validation before starting any report writes', () => {
    const submitReportStart = source.indexOf('const submitReport = async () =>')
    const validationCall = source.indexOf(
      'const validation = validateCoachReportSubmission(',
      submitReportStart,
    )
    const submittingStart = source.indexOf('setIsSubmitting(true)', submitReportStart)
    const driverWrite = source.indexOf('await submitDriverReport()', submitReportStart)
    const coachWrite = source.indexOf('await submitCoachReport()', submitReportStart)

    expect(submitReportStart).toBeGreaterThanOrEqual(0)
    expect(validationCall).toBeGreaterThan(submitReportStart)
    expect(validationCall).toBeLessThan(submittingStart)
    expect(submittingStart).toBeLessThan(driverWrite)
    expect(submittingStart).toBeLessThan(coachWrite)
  })
})
