import { AuditFinding, ConfidenceLevel } from '@/types/audit';

export function confidenceLevelFor(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return 'HIGH';
  if (confidence >= 0.6) return 'MEDIUM';
  return 'LOW';
}

/**
 * Builds a finding with consistent invariants:
 *  - INFO findings never deduct points
 *  - deductions are non-negative integers
 *  - confidenceLevel is derived from numeric confidence
 *  - rawDeductionPoints preserves the rule's requested deduction (before budget capping)
 */
export function makeFinding(f: Omit<AuditFinding, 'confidenceLevel' | 'rawDeductionPoints'>): AuditFinding {
  const deduction = f.severity === 'INFO' ? 0 : Math.max(0, Math.round(f.deductionPoints));
  const confidence = Math.min(1, Math.max(0, f.confidence));
  return {
    ...f,
    confidence,
    deductionPoints: deduction,
    rawDeductionPoints: deduction,
    confidenceLevel: confidenceLevelFor(confidence),
  };
}
