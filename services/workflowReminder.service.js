const { Op } = require('sequelize')
const ssrService = require('./ssr.service')
const WorkflowReminder = require('../models/workflowReminder.model')
const { WORKFLOW_FORMS, getActionablePendingForms } = require('../utils/workflowStatus')
const { sendWorkflowReminderEmail } = require('../emailService/workflowReminder.mailer')

const DEFAULT_FIRST_DELAY_HOURS = 24
const DEFAULT_REPEAT_INTERVAL_HOURS = 24
const DEFAULT_INTERVAL_MINUTES = 60

let schedulerHandle = null
let isRunning = false

const parsePositiveInteger = (value, fallback) => {
  const parsed = parseInt(String(value || '').trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const FIRST_REMINDER_DELAY_HOURS = parsePositiveInteger(
  process.env.SSR_REMINDER_FIRST_DELAY_HOURS,
  parsePositiveInteger(process.env.SSR_REMINDER_DELAYS_HOURS, DEFAULT_FIRST_DELAY_HOURS),
)

const REMINDER_REPEAT_INTERVAL_HOURS = parsePositiveInteger(
  process.env.SSR_REMINDER_REPEAT_INTERVAL_HOURS,
  DEFAULT_REPEAT_INTERVAL_HOURS,
)

const REMINDER_INTERVAL_MS = Math.max(
  parseInt(process.env.SSR_REMINDER_CHECK_INTERVAL_MINUTES || `${DEFAULT_INTERVAL_MINUTES}`, 10) || DEFAULT_INTERVAL_MINUTES,
  5,
) * 60 * 1000

const isReminderSchedulerEnabled = () => String(process.env.SSR_REMINDER_ENABLED || 'true').trim().toLowerCase() !== 'false'

const getReminderDelayToSend = ({ startedAt, sentLogs, now = Date.now() }) => {
  if (!startedAt) return null

  const startedTime = new Date(startedAt).getTime()
  if (Number.isNaN(startedTime)) return null

  const elapsedHours = (now - startedTime) / (1000 * 60 * 60)
  if (elapsedHours < FIRST_REMINDER_DELAY_HOURS) return null

  const sortedLogs = [...(sentLogs || [])].sort((left, right) => {
    const leftSentAt = new Date(left.sentAt || 0).getTime()
    const rightSentAt = new Date(right.sentAt || 0).getTime()
    return leftSentAt - rightSentAt
  })

  const lastLog = sortedLogs[sortedLogs.length - 1] || null
  const lastDelayHours = Number(lastLog?.reminderDelayHours || 0)
  const lastSentAt = new Date(lastLog?.sentAt || 0).getTime()

  if (lastLog && !Number.isNaN(lastSentAt)) {
    const hoursSinceLastSent = (now - lastSentAt) / (1000 * 60 * 60)
    if (hoursSinceLastSent < REMINDER_REPEAT_INTERVAL_HOURS) {
      return null
    }
  }

  const nextDelayHours = lastLog
    ? Math.max(lastDelayHours + REMINDER_REPEAT_INTERVAL_HOURS, FIRST_REMINDER_DELAY_HOURS)
    : FIRST_REMINDER_DELAY_HOURS

  return elapsedHours >= nextDelayHours ? nextDelayHours : null
}

const buildReminderLogMap = (logs) => logs.reduce((acc, log) => {
  const key = `${log.ssrId}:${log.formKey}`
  if (!acc.has(key)) {
    acc.set(key, [])
  }

  acc.get(key).push(log)
  return acc
}, new Map())

const runWorkflowReminderScan = async () => {
  if (isRunning || !isReminderSchedulerEnabled()) return
  isRunning = true

  try {
    const requests = await ssrService.getAllSmallSerialRequests()
    if (!Array.isArray(requests) || requests.length === 0) return

    const logs = await WorkflowReminder.findAll({
      where: {
        ssrId: {
          [Op.in]: requests.map((request) => request.id),
        },
      },
    })

    const sentLogMap = buildReminderLogMap(logs)
    const workflowFormMap = WORKFLOW_FORMS.reduce((acc, form) => {
      acc.set(form.key, form)
      return acc
    }, new Map())

    for (const request of requests) {
      const pendingForms = getActionablePendingForms(request)

      for (const pendingForm of pendingForms) {
        const formInfo = workflowFormMap.get(pendingForm.key)
        const sentLogs = sentLogMap.get(`${request.id}:${pendingForm.key}`) || []
        const delayHours = getReminderDelayToSend({
          startedAt: pendingForm.startedAt,
          sentLogs,
        })

        if (!delayHours) continue

        const [reminderLog, created] = await WorkflowReminder.findOrCreate({
          where: {
            ssrId: request.id,
            formKey: pendingForm.key,
            reminderDelayHours: delayHours,
          },
          defaults: {
            recipientEmails: '',
            sentAt: new Date(),
          },
        })

        if (!created) continue

        try {
          const recipients = await sendWorkflowReminderEmail({
            ssr: request,
            formKey: pendingForm.key,
            formLabel: formInfo?.label || pendingForm.label,
            startedAt: pendingForm.startedAt,
            delayHours,
          })

          if (!recipients.length) {
            await reminderLog.destroy()
            continue
          }

          await reminderLog.update({
            recipientEmails: recipients.join(','),
            sentAt: new Date(),
          })
        } catch (error) {
          await reminderLog.destroy()
          throw error
        }
      }
    }
  } catch (error) {
    console.error('Workflow reminder scan error:', error.message)
  } finally {
    isRunning = false
  }
}

const startWorkflowReminderScheduler = () => {
  if (!isReminderSchedulerEnabled() || schedulerHandle) return

  setTimeout(() => {
    runWorkflowReminderScan().catch((error) => {
      console.error('Initial workflow reminder scan error:', error.message)
    })
  }, 15 * 1000)

  schedulerHandle = setInterval(() => {
    runWorkflowReminderScan().catch((error) => {
      console.error('Scheduled workflow reminder scan error:', error.message)
    })
  }, REMINDER_INTERVAL_MS)

  console.log(
    `Workflow reminder scheduler started (scan every ${Math.round(REMINDER_INTERVAL_MS / 60000)} minute(s), first reminder after ${FIRST_REMINDER_DELAY_HOURS}h, then every ${REMINDER_REPEAT_INTERVAL_HOURS}h)`,
  )
}

module.exports = {
  runWorkflowReminderScan,
  startWorkflowReminderScheduler,
}
