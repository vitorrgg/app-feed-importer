const admin = require('firebase-admin')
var serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const { handleFeedQueue } = require('../lib/tasks')
const { setup } = require('@ecomplus/application-sdk')


const testHandleFeedQueue = async () => {
  setup(null, true, admin.firestore())
  feedUrl = 'https://lojasereiarte.com.br/google_shopping.xml'
  await handleFeedQueue(1117, feedUrl)
}


testHandleFeedQueue()