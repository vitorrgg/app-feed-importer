const admin = require('firebase-admin')
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)

const feedProduct = require('./mocks/product-feed.json')


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// const { handleFeedQueue } = require('../lib/tasks')

const { setup } = require('@ecomplus/application-sdk')
const { parseProduct } = require('../lib/gmc-to-ecom')

// const testHandleFeedQueue = async () => {
//   setup(null, true, admin.firestore())
//   const feedUrl = 'https://lojasereiarte.com.br/google_shopping.xml'
//   await handleFeedQueue(1117, feedUrl)
// }

const testParserProduct = async () => {
  setup(null, true, admin.firestore())
  const parsedProduct = await parseProduct(feedProduct)
  console.log('parsedProduct', parsedProduct)
}

// testHandleFeedQueue()

testParserProduct()
