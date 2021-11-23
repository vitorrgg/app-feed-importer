
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
  const { data: feedData } = await getFeed(feedUrl)
  const parsedFeed = xmlParser.parse(feedData)
  const products = getFeedItems(parsedFeed)
  for (const product of products) {
    const trigger = {
      resource: 'feed_create_product',
      body: product,
      store_id: storeId
    }

    addNotification(admin, trigger)
  }
}

exports.onEcomNotification = functions.firestore
  .document('ecom_notifications/{documentId}')
  .onCreate(async (snap) => {
    let hasError = false
    logger.info('[ecomNotification:start task]', JSON.stringify(snap.data()))

    try {
      const appSdk = await setup(null, true, admin.firestore())
      const notification = snap.data()
      const { resource, store_id: storeId, body } = notification
      const appData = await getAppData({ appSdk, storeId, auth })

      switch (resource) {
        case 'applications':
          if (body && body.feed_url) {
            await handleFeedQueue(storeId, body.feed_url)
          }
          break

        case 'feed_create_product':
          await saveEcomProduct(appSdk, appData, storeId, body)
          // fazer o parse do produto
          // verificar se o produto já existe
          // caso exista, atualiza | caso não exista cria
          // Provavelmente vamos precisar ter um campo que pergunta se o usuário vai querer sobrescrer o produto
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