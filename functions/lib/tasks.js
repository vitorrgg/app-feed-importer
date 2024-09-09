
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

const { differenceInMinutes } = require('date-fns')

const tableToEcom = require('./table-to-ecom')

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

const handleFeedQueue = async (storeId, products) => {
  try {
    logger.info('[handleFeedQueue]', JSON.stringify({ storeId }))

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

const handleFeedXmlQueue = async (storeId, feedUrl) => {
  try {
    logger.info('[handleFeedXmlQueue]', JSON.stringify({ storeId, feedUrl }))
    const { data: feedData } = await getFeed(feedUrl)
    const parsedFeed = xmlParser.parse(feedData)
    const products = getFeedItems(parsedFeed)
    await handleFeedQueue(storeId, products)
  } catch (error) {
    logger.error('[handleFeedXmlQueue:error]', { error })
    throw error
  }
}

const handleFeedTableQueue = async (notification) => {
  try {
    const { body, store_id: storeId } = notification
    const storageBucket = admin.storage().bucket('gs://ecom-feed-importer.appspot.com')
    const [data] = await storageBucket.file(body.file_id).download()
    logger.info(`[tableToEcom.parseProduct:start] ${body.file_id} => ${data.length} bytes`)
    // 5.242.880 = 5MB
    if (data.length < 5242880) {
      const products = await tableToEcom.parseProduct(data, body.contentType)
      await handleFeedQueue(storeId, products)
    } else {
      logger.warn(`[s:${storeId}] ${body.file_id} very large file`)
    }
  } catch (error) {
    logger.warn('[tableToEcom.parseProduct:error]')
    logger.error(error)
    throw error
  }
}

const run = async (snap, data = null) => {
  const meta = { }
  let hasError = false
  const notification = data || snap.data()
  logger.info(`[ecomNotification:start task]: ${snap.id} => ${JSON.stringify(notification)}, `)
  try {
    const appSdk = await setup(null, true, admin.firestore())
    const { resource, store_id: storeId, body, isVariation } = notification
    const appData = await getAppData({ appSdk, storeId, auth })
    let product = isVariation ? body[0] : body
    if (!product['g:title'] && isVariation) {
      product = body.find(feed => feed['g:title']) || product
    }

    const variations = isVariation ? body : []

    let productId

    const aditionalImages = Array.isArray(product['g:additional_image_link'])
      ? product['g:additional_image_link']
      : [product['g:additional_image_link']]

    const imageLinks = _.compact([product['g:image_link'], ...(aditionalImages || [])])

    switch (resource) {
      case 'applications':
        if (body && body.feed_url) {
          await handleFeedXmlQueue(storeId, body.feed_url)
        }
        break

      case 'feed_create_product':
        productId = await saveEcomProduct(appSdk, appData, storeId, product, variations, isVariation, meta)
        if (productId && productId._id && imageLinks.length) {
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
      case 'feed_import_table':
        await handleFeedTableQueue(notification)
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
          ...notification,
          hasError: true,
          error: { status: error.response.status, data: error.response.data },
          attempts: parseInt(notification.attempts || 0) + 1,
          ready_at: admin.firestore.Timestamp.now().toMillis() + 500,
          meta
        },
        { merge: true }
      )
      return true
    }

    await snap.ref.set(
      {
        ...notification,
        hasError: true,
        error: error.message,
        attempts: parseInt(notification.attempts || 0) + 1,
        ready_at: admin.firestore.Timestamp.now().toMillis() + 500,
        meta
      },
      { merge: true }
    )
    logger.error(error)
    return true
  } finally {
    if (!hasError) {
      snap.ref.delete()
    }

    if (notification.attempts && notification.attempts >= 3) {
      admin.firestore().collection('ecom_notification_dead_letter_queue').add({ ...notification, ...snap.data() })
      snap.ref.delete()
    }
  }
}

const handleWorker = async () => {
  const queueControllerRef = admin.firestore().collection('queue_controller')

  let queueControllerSnap = await queueControllerRef.get()
  if (queueControllerSnap.empty) {
    await queueControllerRef.add({
      running: false
    })
    queueControllerSnap = await queueControllerRef.get()
  }
  let queueController = queueControllerSnap.docs[0]

  try {
    const notificationRef = admin.firestore().collection('ecom_notifications')
    const queueState = queueController.data()
    const queueLastExecution = queueState.last_excution?.toMillis()
    const now = admin.firestore.Timestamp.now().toMillis()
    if (queueLastExecution && (now - queueLastExecution >= 2 * 60 * 1000) && (queueState.store_ids && queueState.store_ids.length)) {
      logger.warn('>Reset execution')
      await queueControllerRef.doc(queueController.id).set({
        running: false,
        store_ids: [],
        last_excution: admin.firestore.Timestamp.now()
      }, { merge: true })

      return
    }
    if (queueState.running && (!queueState.store_ids || !queueState.store_ids.length)) {
      return
    }
    const query = notificationRef
      .where('ready_at', '<=', now)
      .orderBy('ready_at').limit(600)

    const limitDocs = 100

    const notificationDocs = await query.get()
    const storeIds = []
    if (!notificationDocs.empty) {
      const docsToRun = []
      let limitQueueSize = limitDocs
      notificationDocs.forEach(doc => {
        const data = doc.data()
        if (docsToRun.length < limitQueueSize) {
          let isPushDoc = true
          if (queueState && queueState.store_ids && !queueState.store_ids.includes(data.store_id)) {
            if (!storeIds.includes(data.store_id)) {
              storeIds.push(data.store_id)
            }
            if (data.resource === 'feed_import_image') {
              // queue size depends on the amount of images
              const quantityImgs = data.body?.imageLinks?.length
              limitQueueSize -= quantityImgs || 0
            } else if (data.resource === 'feed_import_table') {
              // import one table at a time
              isPushDoc = limitQueueSize > (limitDocs - 10)
              limitQueueSize = isPushDoc ? 0 : limitQueueSize
            }
            if (isPushDoc) {
              docsToRun.push(run(doc, data))
            }
          }
        }
      })
      queueControllerRef.doc(queueController.id).set({
        running: true,
        store_ids: storeIds
      }, { merge: true })
      await Promise.allSettled(docsToRun)
    }

    queueControllerSnap = await queueControllerRef.get()
    queueController = queueControllerSnap.docs[0]
    const newQueueState = queueController.data()
    if (newQueueState.store_ids) {
      storeIds.forEach(storeId => {
        const index = newQueueState.store_ids.indexOf(storeId)
        if (index > -1) {
          newQueueState.store_ids.splice(index, 1)
        }
      })
      newQueueState.running = Boolean(newQueueState.store_ids.length)
    } else {
      newQueueState.running = false
    }
    newQueueState.last_excution = admin.firestore.Timestamp.now()
    queueControllerRef.doc(queueController.id).set(newQueueState)
  } catch (error) {
    logger.error(error)
  } finally {
    const lastExcution = queueController.data().last_excution
    if (differenceInMinutes(admin.firestore.Timestamp.now().toDate(), lastExcution.toDate()) > 9) {
      queueControllerRef.doc(queueController.id)
        .set({ running: false, last_excution: admin.firestore.Timestamp.now() })
      logger.info('[handleWorker]: changed running to false because has more 9 minutes inactivity')
    }
  }
}

module.exports = {
  handleFeedXmlQueue,
  handleFeedTableQueue,
  handleFeedQueue,
  handleWorker,
  run
}
