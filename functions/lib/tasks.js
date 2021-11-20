
const functions = require('firebase-functions')
const admin = require('firebase-admin')
const axios = require('axios').default
const xmlParser = require('fast-xml-parser')

const addNotification = require('../utils/addNotification')

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
    try {
      const notification = snap.data()
      const { resource, store_id: storeId, body } = notification

      switch (resource) {
        case 'applications':
          if (body && body.feed_url) {
            await handleFeedQueue(storeId, body.feed_url)
          }
          break

        case 'feed_create_product':
          // fazer o parse do produto
          // verificar se o produto já existe
          // caso exista, atualiza | caso não exista cria
          // Provavelmente vamos precisar ter um campo que pergunta se o usuário vai querer sobrescrer o produto
          break
        default:
          break
      }
    } catch (error) {

    }
  })

module.exports = {
  handleFeedQueue
}
