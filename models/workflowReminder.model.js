const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequelize')

const WorkflowReminder = sequelize.define(
  'WorkflowReminder',
  {
    ssrId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ssr_id',
      references: {
        model: 'small_serial_requests',
        key: 'id',
      },
    },
    formKey: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'form_key',
    },
    reminderDelayHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reminder_delay_hours',
    },
    recipientEmails: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'recipient_emails',
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'sent_at',
    },
  },
  {
    tableName: 'workflow_reminders',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['ssr_id', 'form_key', 'reminder_delay_hours'],
      },
    ],
  },
)

module.exports = WorkflowReminder
