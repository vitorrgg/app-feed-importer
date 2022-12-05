const functions = require('firebase-functions')

module.exports = (admin, trigger) => {
  trigger.attempts = 0
  trigger.ready_at = admin.firestore.Timestamp.now().toMillis() + 500
  console.log('Trigger a ser inserido', JSON.stringify(trigger))
  if (typeof trigger.store_id !== 'number') {
    trigger.store_id = parseInt(trigger.store_id, 10)
  }
  functions.logger.info('[addNotification]', trigger)
  return admin.firestore()
    .collection('ecom_notifications')
    .add(trigger)
}
