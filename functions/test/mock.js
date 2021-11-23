const admin = require('firebase-admin')
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)

const feedProduct = require('./mocks/product-feed.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// const { handleFeedQueue } = require('../lib/tasks')

const { setup } = require('@ecomplus/application-sdk')
const { parseProduct, tryImageUpload, saveEcomProduct } = require('../lib/gmc-to-ecom')

// const testHandleFeedQueue = async () => {
//   setup(null, true, admin.firestore())
//   const feedUrl = 'https://lojasereiarte.com.br/google_shopping.xml'
//   await handleFeedQueue(1117, feedUrl)
// }

// const testParserProduct = async () => {
//   setup(null, true, admin.firestore())
//   const appData = {
//     // default_quantity: 10
//   }
//   const parsedProduct = await parseProduct(appData, feedProduct)
//   console.log('parsedProduct', parsedProduct)
// }

// const testSaveProduct = async () => {
//   const appSdk = await setup(null, true, admin.firestore())
//   const appData = {
//     default_quantity: 11,
//     update_product: true
//   }
//   const product = await saveEcomProduct(appSdk, appData, 1117, feedProduct)
//   console.log('savedProduct', product)
// }

const testTryImageUpload = async () => {
  const appSdk = await setup(null, true, admin.firestore())
  const appData = {
    default_quantity: 3,
    update_product: true
  }
  const imageUpload = await tryImageUpload(appSdk, appData, feedProduct, tryImageUpload)
  
}

// testHandleFeedQueue()

// testParserProduct()

// testSaveProduct()

testTryImageUpload