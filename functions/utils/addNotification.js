const functions = require('firebase-functions')

module.exports = (admin, trigger) => {
  trigger.attempts = 0
  trigger.ready_at = admin.firestore.Timestamp.now().toMillis() + 1000
  functions.logger.info('[addNotification]', trigger)
  return admin.firestore()
    .collection('ecom_notifications')
    .add(trigger)
}
