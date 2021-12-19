const admin = require('firebase-admin')
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
const _ = require('lodash')
const { auth } = require('firebase-admin')
const getAppData = require('./../lib/store-api/get-app-data')

// const feedProduct = require('./mocks/product-feed.json')
const fs = require('fs')
const path = require('path')
const axios = require('axios').default

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// const { handleFeedQueue } = require('../lib/tasks')

const { setup } = require('@ecomplus/application-sdk')
const { parseProduct, tryImageUpload, saveEcomProduct, getSpecifications } = require('../lib/gmc-to-ecom')
const xmlParser = require('fast-xml-parser')
const { handleFeedQueue, handleWorker, run } = require('../lib/tasks')

const testHandleFeedQueue = async () => {
  setup(null, true, admin.firestore())
  const feedUrl = 'https://apks-pds.s3.amazonaws.com/example_feed_xml_rss.xml'
  await handleFeedQueue(1117, feedUrl)
}

// const testCreateQueueController = async () => {
//   await setup(null, true, admin.firestore())
//   await handleWorker()
// }

// const testRun = async () => {
//   await setup(null, true, admin.firestore())
//   const notificationRef = await admin.firestore().collection('ecom_notifications').get()
//   let canRun = true
//   const p = []
//   notificationRef.forEach(async doc => {
//     if (canRun) {
//       p.push(doc)
//       canRun = false
//     }
//   })

//   console.log(p)

//   await Promise.all(p)
// }

// testRun()

const testParseProduct = async () => {
  const appSdk = await setup(null, true, admin.firestore())
  const notificationRef = await admin.firestore().collection('ecom_notifications').get()
  const { store_id: storeId, body, isVariation } = notificationRef.docs[0].data()
  const appData = await getAppData({ appSdk, storeId, auth })
  const product = isVariation ? body[0] : body
  const variations = isVariation ? body : []

  const productId = await saveEcomProduct(appSdk, appData, storeId, product, variations, isVariation)
  console.log(productId)
}

testParseProduct()
