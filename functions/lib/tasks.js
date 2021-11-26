
const functions = require('firebase-functions')
const admin = require('firebase-admin')
const { auth } = require('firebase-admin')
const axios = require('axios').default
const xmlParser = require('fast-xml-parser')
const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const { logger } = require('firebase-functions')

const addNotification = require('../utils/addNotification')
const { saveEcomProduct } = require('./gmc-to-ecom')
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

exports.handleFeedQueue = handleFeedQueue

exports.onEcomNotification = functions.firestore
  .document('ecom_notifications/{documentId}')
  .onCreate(async (snap) => {
    let hasError = false
    logger.info('[ecomNotification:start task]', JSON.stringify(snap.data()))

    try {
      const appSdk = await setup(null, true, admin.firestore())
      const notification = snap.data()
      const { resource, store_id: storeId, body, isVariation } = notification
      const appData = await getAppData({ appSdk, storeId, auth })
      const product = isVariation ? body[0] : body
      const variations = isVariation ? body : []
      switch (resource) {
        case 'applications':
          if (body && body.feed_url) {
            await handleFeedQueue(storeId, body.feed_url)
          }
          break

        case 'feed_create_product':
          await saveEcomProduct(appSdk, appData, storeId, product, variations, isVariation)
          break
        default:
          break
      }
    } catch (error) {
      hasError = true
      if (error && error.response) {
        logger.error({ status: error.response.status, data: error.response.data })
        await snap.ref.set(
          { hasError: true, error: { status: error.response.status, data: error.response.data } },
          { merge: true }
        )
        return true
      }

      await snap.ref.set({ hasError: true, error: error.message }, { merge: true })
      logger.error(error)
      return true
    } finally {
      if (!hasError) {
        snap.ref.delete()
      }
    }
  })
