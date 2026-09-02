const { toSpecRole } = require("./roles");

const id = (value) => {
  if (!value) return null;

  return value._id ? value._id.toString() : value.toString();
};

const iso = (value) => (value ? new Date(value).toISOString() : null);

const isoDate = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

const toUser = (user) => ({
  id: id(user._id),
  fullName: user.fullName,
  username: user.username,
  phone: user.phone || null,
  role: toSpecRole(user.role),
  active: user.status === "active",
  createdAt: iso(user.createdAt),
});

const toLead = (lead) => ({
  id: id(lead._id),
  name: lead.name || "",
  phone: lead.phone,
  status: lead.status,
  assignedAgentId: id(lead.assignedAgentId),
  rescheduledAt: iso(lead.rescheduledAt),
  note: lead.note || "",
  createdAt: iso(lead.createdAt),
});

const toCall = (call) => ({
  id: id(call._id),
  leadId: id(call.leadId),
  agentId: id(call.agentId),
  outcome: call.outcome,
  note: call.note || "",
  recordingUrl: call.recordingUrl || null,
  calledAt: iso(call.calledAt),
});

const toPayoutRecipient = (recipient) => ({
  recipientName: (recipient && recipient.recipientName) || "",
  accountOrWalletNumber: (recipient && recipient.accountOrWalletNumber) || "",
  isBigMandoob: Boolean(recipient && recipient.isBigMandoob),
});

const toMandoob = (mandoob) => ({
  id: id(mandoob._id),
  name: mandoob.name,
  phone: mandoob.phone,
  nationalId: mandoob.nationalId,
  licensePictureUrl: mandoob.licensePictureUrl || null,
  vehicleType: mandoob.vehicleType,
  kind: mandoob.kind,
  cities: mandoob.cities || [],
  status: mandoob.status,
  deactivationReason: mandoob.deactivationReason || null,
  payoutRecipient: toPayoutRecipient(mandoob.payoutRecipient),
  userId: id(mandoob.userId),
  createdAt: iso(mandoob.createdAt),
});

const toCompany = (company) => ({
  id: id(company._id),
  name: company.name,
  createdAt: iso(company.createdAt),
});

const toMandoobCompany = (link) => ({
  id: id(link._id),
  companyId: id(link.companyId),
  companyName:
    link.companyId && link.companyId.name ? link.companyId.name : null,
  starId: link.starId || null,
  username: link.username || null,
});

const toSalaryLine = (line) => ({
  id: id(line._id),
  mandoobId: id(line.mandoobId),
  companyId: id(line.companyId),
  companyName:
    line.companyId && line.companyId.name ? line.companyId.name : null,
  period: line.period,
  totalSalary: line.totalSalary,
  source: line.source,
  createdAt: iso(line.createdAt),
});

const toInstallment = (installment) => ({
  number: installment.number,
  amount: installment.amount,
  dueDate: isoDate(installment.dueDate),
  paid: Boolean(installment.paid),
});

const toLoan = (loan) => ({
  id: id(loan._id),
  mandoobId: id(loan.mandoobId),
  principal: loan.principal,
  installmentAmount: loan.installmentAmount,
  installmentsCount: loan.installmentsCount,
  installmentsPaid: loan.installmentsPaid,
  remainingBalance: loan.remainingBalance,
  status: loan.status,
  eligible: loan.eligible,
  exceptionApproved: loan.exceptionApproved,
  decisionByUserId: id(loan.decisionByUserId),
  decisionReason: loan.decisionReason || null,
  schedule: (loan.schedule || []).map(toInstallment),
  createdAt: iso(loan.createdAt),
});

const toDeduction = (deduction) => ({
  id: id(deduction._id),
  mandoobId: id(deduction.mandoobId),
  type: deduction.type,
  amount: deduction.amount,
  reason: deduction.reason || "",
  loanId: id(deduction.loanId),
  recordedByUserId: id(deduction.recordedByUserId),
  createdAt: iso(deduction.createdAt),
});

const toBlockEntry = (entry) => ({
  id: id(entry._id),
  phone: entry.phone || null,
  nationalId: entry.nationalId || null,
  reason: entry.reason,
  active: Boolean(entry.active),
  createdByUserId: id(entry.createdByUserId),
  createdAt: iso(entry.createdAt),
  unblockedByUserId: id(entry.unblockedByUserId),
  unblockReason: entry.unblockReason || null,
  unblockedAt: iso(entry.unblockedAt),
});

const toSalaryImportIssue = (issue) => ({
  row: issue.row,
  type: issue.type,
  message: issue.message,
});

const toSalaryImport = (batch) => ({
  id: id(batch._id),
  companyId: id(batch.companyId),
  period: batch.period,
  status: batch.status,
  totalRows: batch.totalRows,
  validRows: batch.validRows,
  issues: (batch.issues || []).map(toSalaryImportIssue),
  createdByUserId: id(batch.createdByUserId),
  createdAt: iso(batch.createdAt),
});

const toPayment = (payment) => ({
  id: id(payment._id),
  mandoobId: id(payment.mandoobId),
  period: payment.period,
  grossAmount: payment.grossAmount,
  deductionsAmount: payment.deductionsAmount,
  netAmount: payment.netAmount,
  method: payment.method,
  status: payment.status,
  recipient: toPayoutRecipient(payment.recipient),
  screenshotUrl: payment.screenshotUrl || null,
  paidByUserId: id(payment.paidByUserId),
  createdAt: iso(payment.createdAt),
});

const toGeoZone = (zone) => ({
  latitude: zone ? zone.latitude : null,
  longitude: zone ? zone.longitude : null,
  radiusMeters: zone && zone.radiusMeters !== undefined ? zone.radiusMeters : 100,
});

const toTrainingSession = (session) => ({
  id: id(session._id),
  companyId: id(session.companyId),
  scheduledAt: iso(session.scheduledAt),
  durationMinutes: session.durationMinutes,
  requiredStayMinutes: session.requiredStayMinutes,
  zone: toGeoZone(session.zone),
});

const toTrainingAssignment = (assignment) => ({
  id: id(assignment._id),
  sessionId: id(assignment.sessionId),
  mandoobId: id(assignment.mandoobId),
  attended: Boolean(assignment.attended),
  attendedAt: iso(assignment.attendedAt),
});

const toRole = (role) => ({
  id: role.id || id(role._id),
  name: role.name,
  builtIn: Boolean(role.builtIn),
  permissions: role.permissions || [],
});

module.exports = {
  id,
  iso,
  isoDate,
  toUser,
  toBlockEntry,
  toSalaryImport,
  toSalaryImportIssue,
  toPayment,
  toGeoZone,
  toTrainingSession,
  toTrainingAssignment,
  toRole,
  toLead,
  toCall,
  toMandoob,
  toPayoutRecipient,
  toCompany,
  toMandoobCompany,
  toSalaryLine,
  toLoan,
  toInstallment,
  toDeduction,
};
