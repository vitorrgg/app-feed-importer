const functions = require('firebase-functions')

module.exports = (admin, trigger) => {
  functions.logger.info('[addNotification]', trigger)
  return admin.firestore()
    .collection('ecom_notifications')
    .add(trigger)
}
