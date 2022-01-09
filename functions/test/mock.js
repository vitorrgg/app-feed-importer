const admin = require('firebase-admin')
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
const _ = require('lodash')
const { auth } = require('firebase-admin')
const getAppData = require('./../lib/store-api/get-app-data')
const ExcelJS = require('exceljs')
const path = require('path')
// const feedProduct = require('./mocks/product-feed.json')
const fs = require('fs')
const axios = require('axios').default
// const { differenceInMinutes } = require('date-fns')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// // const { handleFeedQueue } = require('../lib/tasks')

const { setup } = require('@ecomplus/application-sdk')
const { parseProduct, tryImageUpload, saveEcomProduct, getSpecifications } = require('../lib/gmc-to-ecom')
const xmlParser = require('fast-xml-parser')
const { handleFeedTableQueue, run, handleFeedQueue } = require('../lib/tasks')
const tableFeed = require('../lib/table-to-ecom')
// const { handleFeedQueue, handleWorker, run } = require('../lib/tasks')

// const testHandleFeedQueue = async () => {
//   setup(null, true, admin.firestore())
//   const feedUrl = 'https://apks-pds.s3.amazonaws.com/example_feed_xml_rss.xml'
//   await handleFeedQueue(1117, feedUrl)
// }

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

const getFeedItems = (feedData) => {
  const hasRssProperty = Object.prototype.hasOwnProperty.call(feedData, 'rss')

  if (feedData && hasRssProperty) {
    return feedData && feedData.rss && feedData.rss.channel.item
  }
  return feedData && feedData.feed && feedData.feed.entry
}

const getFeed = async (feedUrl) => {
  return axios.get(feedUrl)
}

const testHandleFeedQueue = async (storeId, feedUrl) => {
  try {
    await setup(null, true, admin.firestore())
    const { data: feedData } = await getFeed(feedUrl)
    const parsedFeed = xmlParser.parse(feedData)
    const products = getFeedItems(parsedFeed)
    const groupedProducts = _.groupBy(products, (item) => _.get(item, 'g:item_group_id', 'without_variations'))

    const { without_variations: withoutVariations } = groupedProducts
    delete groupedProducts.without_variations
    for (const key of Object.keys(groupedProducts)) {
      const trigger = {
        resource: 'feed_create_product',
        body: groupedProducts[key],
        store_id: storeId,
        isVariation: true
      }
      console.log(trigger)
    }

    for (const product of withoutVariations || []) {
      const trigger = {
        resource: 'feed_create_product',
        body: product,
        store_id: storeId,
        isVariation: false
      }
      console.log(trigger)
    }
  } catch (error) {
    console.log(error)
  }
}

// testHandleFeedQueue(1117, 'https://apks-pds.s3.amazonaws.com/example_feed_xml_rss.xml')
// const testSaveProduct = async () => {
//   const appSdk = await setup(null, true, admin.firestore())
//   const notificationRef = await admin.firestore().collection('ecom_notifications').get()
//   const { store_id: storeId, body, isVariation } = notificationRef.docs[0].data()
//   const appData = await getAppData({ appSdk, storeId, auth })
//   const product = isVariation ? body[0] : body
//   const variations = isVariation ? body : []

//   const productId = await saveEcomProduct(appSdk, appData, storeId, product, variations, isVariation)
//   console.log(productId)
// }

// testSaveProduct()

// const testSize = async () => {
//   admin.firestore().collection('ecom_notifications').where('resource', '==', 'feed_import_image').get().then(snap => {
//     console.log(snap.size) // will return the collection size
//   })
// }

// const testChangeLastExcution = async () => {
//   const queueControllerRef = admin.firestore().collection('queue_controller')

//   const queueDoc = await queueControllerRef.get()
//   if (queueDoc.empty) {
//     await queueControllerRef.add({
//       running: false
//     })
//   }

//   const queueControllerSnap = await queueControllerRef.get()
//   const queueController = queueControllerSnap.docs[0]
//   const lastExcution = queueController.data().last_excution

//   console.log(queueController.data())
//   console.log(admin.firestore.Timestamp.now(), lastExcution)
//   console.log('DIFFERENCE', differenceInMinutes(admin.firestore.Timestamp.now().toDate(), lastExcution.toDate()))
//   console.log('MORE 2 MINUTES', differenceInMinutes(admin.firestore.Timestamp.now(), lastExcution) > 2)
// }

// testSize()
// testChangeLastExcution()

const importNotification = async () => {
  await setup(null, true, admin.firestore())
  const ref = admin
    .firestore()
    .collection('ecom_notifications')
  const docs = await ref.get()
  let canRun = true
  docs.forEach(async snap => {
    if (canRun) {
      await run(snap)
      canRun = false
    }
  })
}

// importNotification()

const parseCsv = async () => {
  await setup(null, true, admin.firestore())
  const data = await fs.readFileSync(path.join(__dirname, 'lojaintegrada.csv'))
  const parsedCsv = await tableFeed.parseProduct(data, 'text/csv')
  console.log(parsedCsv.filter(x => x['g:item_group_id'] === 'ZZHRYMVFM').map(x => ({ id: x['g:id'], item_group_id: x['g:item_group_id'], sku: x['g:sku'] })))
  handleFeedQueue(1117, parsedCsv)
}

parseCsv()
