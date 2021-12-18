
const functions = require('firebase-functions')
const admin = require('firebase-admin')
const { auth } = require('firebase-admin')
const axios = require('axios').default
const xmlParser = require('fast-xml-parser')
const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const { logger } = require('firebase-functions')

const addNotification = require('../utils/addNotification')
const { saveEcomProduct, saveEcomImages } = require('./gmc-to-ecom')
const _ = require('lodash')

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

const handleFeedQueue = async (storeId, feedUrl) => {
  try {
    logger.info('[handleFeedQueue]', JSON.stringify({ storeId, feedUrl }))
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
      addNotification(admin, trigger)
    }

    for (const product of withoutVariations || []) {
      const trigger = {
        resource: 'feed_create_product',
        body: product,
        store_id: storeId,
        isVariation: false
      }
      addNotification(admin, trigger)
    }
  } catch (error) {
    logger.error('[handleFeedQueue: error to process xmlparse]', error)
    throw error
  }
}

const run = async (snap) => {
  let hasError = false
  const notification = snap.data()
  logger.info('[ecomNotification:start task]', JSON.stringify(notification))
  try {
    const appSdk = await setup(null, true, admin.firestore())
    const { resource, store_id: storeId, body, isVariation } = notification
    const appData = await getAppData({ appSdk, storeId, auth })
    const product = isVariation ? body[0] : body
    const variations = isVariation ? body : []

    let productId

    const aditionalImages = Array.isArray(product['g:additional_image_link'])
      ? product['g:additional_image_link']
      : [product['g:additional_image_link']]

    const imageLinks = _.compact([product['g:image_link'], ...(aditionalImages || [])])

    switch (resource) {
      case 'applications':
        if (body && body.feed_url) {
          await handleFeedQueue(storeId, body.feed_url)
        }
        break

      case 'feed_create_product':
        productId = await saveEcomProduct(appSdk, appData, storeId, product, variations, isVariation)
        if (productId && imageLinks.length) {
          addNotification(admin, {
            store_id: storeId,
            resource: 'feed_import_image',
            body: {
              product_id: productId._id,
              imageLinks
            }
          })
        }
        break
      case 'feed_import_image':
        await saveEcomImages(appSdk, storeId, body.product_id, body.imageLinks)
        break
      default:
        break
    }
  } catch (error) {
    hasError = true
    if (error && error.response) {
      logger.error({ status: error.response.status, data: error.response.data })
      await snap.ref.set(
        { 
          hasError: true, 
          error: { status: error.response.status, data: error.response.data }, 
          attempts: parseInt(notification.attempts || 0 ) + 1,
          ready_at: admin.firestore.Timestamp.now().toMillis() + 1000
        },
        { merge: true }
      )
      return true
    }

    await snap.ref.set(
      { 
        hasError: true, 
        error: error.message,
        attempts: parseInt(notification.attempts || 0 ) + 1,
        ready_at: admin.firestore.Timestamp.now().toMillis() + 1000
      }, 
      { merge: true }
    )
    logger.error(error)
    


    return true
  } finally {
    if (!hasError) {
      snap.ref.delete()
    }

    if (notification.attempts && notification.attempts > 3) {
      admin.firestore().collection('ecom_notification_dead_letter_queue').add(snap.data())
      snap.ref.delete()
    }

  }
}



const handleWorker = async () => {
  const queueControllerRef = admin.firestore().collection('queue_controller')

  const queueDoc = await queueControllerRef.get()
  if (queueDoc.empty) {
    await queueControllerRef.add({
      running: false,
    })
  }

  const queueControllerSnap = await queueControllerRef.get()
  const queueController = queueControllerSnap.docs[0]

  try {
    console.log('queueController', queueController.data())
    if (!queueController.data().running) {
      queueControllerRef.doc(queueController.id).set({ running: true }, { merge: true })
      let notificationRef = admin.firestore().collection('ecom_notifications')
      let query = notificationRef
      .where('ready_at', '<=', admin.firestore.Timestamp.now().toMillis())
      .orderBy('ready_at')
      .limit(10)

      const notificatioDocs = await query.get()      
      console.log('notification docs', notificatioDocs.empty)
      const docsToRun = []
      notificatioDocs.forEach(doc => {
        docsToRun.push(run(doc))
      })
      await Promise.allSettled(docsToRun)
      queueControllerRef.doc(queueController.id)
        .set({ running: false, last_excution: admin.firestore.Timestamp.now() })
    }
  } catch (error) {
    console.log(error)
    queueControllerRef.doc(queueController.id)
      .set({ running: false, last_excution: admin.firestore.Timestamp.now() })
  }
}

module.exports = {
  handleFeedQueue,
  handleWorker
}