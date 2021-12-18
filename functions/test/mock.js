const admin = require('firebase-admin')
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
const _ = require('lodash')

// const feedProduct = require('./mocks/product-feed.json')
const fs = require('fs')
const path = require('path')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// const { handleFeedQueue } = require('../lib/tasks')

const { setup } = require('@ecomplus/application-sdk')
const { parseProduct, tryImageUpload, saveEcomProduct, getSpecifications } = require('../lib/gmc-to-ecom')
const xmlParser = require('fast-xml-parser')
const { handleFeedQueue, handleWorker } = require('../lib/tasks')

const testHandleFeedQueue = async () => {
  setup(null, true, admin.firestore())
  const feedUrl = 'https://apks-pds.s3.amazonaws.com/example_feed_xml_rss.xml'
  await handleFeedQueue(1117, feedUrl)
}

// const testParserProduct = async () => {
//   const appSdk = await setup(null, true, admin.firestore())
//   const appData = {
//     // default_quantity: 10
//   }
//   const parsedProduct = await parseProduct(appSdk, appData, feedProduct)
//   console.log('parsedProduct', parsedProduct)
// }

// feedItems.map(x => { return { id: x['g:id'], images: _.compact(_.flattenDeep([x['g:additional_image_link'], x['g:image_link']]))}})

const getFeedItems = (feedData) => {
  const hasRssProperty = Object.prototype.hasOwnProperty.call(feedData, 'rss')

  if (feedData && hasRssProperty) {
    return feedData && feedData.rss && feedData.rss.channel.item
  }
  return feedData && feedData.feed && feedData.feed.entry
}

const testSaveProduct = async () => {
  const appSdk = await setup(null, true, admin.firestore())
  const appData = {
    default_quantity: 11,
    update_product: true
  }

  const feedData = fs.readFileSync(path.join(__dirname, './example_feed_xml_rss.xml'), { encoding: 'utf8', flag: 'r' })
  const parsedFeed = xmlParser.parse(feedData)
  const feedProducts = getFeedItems(parsedFeed)
  const groupedProducts = _.groupBy(feedProducts, (item) => _.get(item, 'g:item_group_id', 'without_variations'))

  delete groupedProducts.without_variations

  for (const key of Object.keys(groupedProducts)) {
    try {
      const feed = groupedProducts[key]
      console.log('savedProduct', await saveEcomProduct(appSdk, appData, 1117, feed[0], feed, true))
    } catch (error) {
      console.log(error)
    }
  }
}

// const testTryImageUpload = async () => {
//   const appSdk = await setup(null, true, admin.firestore())
//   const appData = {
//     default_quantity: 3,
//     update_product: true
//   }
//   const imageUpload = await tryImageUpload(appSdk, appData, feedProduct, tryImageUpload)
// }

// const testGetSpecifications = async () => {
//   await setup(null, true, admin.firestore())
//   const specifications = getSpecifications(feedProduct)
//   console.log('specifications', specifications)
// }

// testHandleFeedQueue()

// testParserProduct()

// testSaveProduct()

// testTryImageUpload

// testGetSpecifications()


const testCreateQueueController = async () => {
  await setup(null, true, admin.firestore())
  await handleWorker()
}


testCreateQueueController()