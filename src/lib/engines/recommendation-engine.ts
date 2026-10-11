import { AuditFinding } from '@/types/audit';

/**
 * Sorts and ranks audit findings into prioritized fixes.
 * Ordering: Severity (CRITICAL > HIGH > MEDIUM > LOW > INFO) x Confidence x Deduction Points.
 */
export function prioritizeFindings(findings: AuditFinding[]): AuditFinding[] {
  const severityWeight = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    INFO: 0,
  };

  return [...findings].sort((a, b) => {
    const weightA = severityWeight[a.severity] * 100 + Math.round(a.confidence * 10) + a.deductionPoints;
    const weightB = severityWeight[b.severity] * 100 + Math.round(b.confidence * 10) + b.deductionPoints;
    return weightB - weightA;
  });
}
