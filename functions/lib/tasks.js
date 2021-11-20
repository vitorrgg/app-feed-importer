
const functions = require('firebase-functions')
const { auth } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const admin = require('firebase-admin')
const getAppData = require('./store-api/get-app-data')
const { logger } = require('firebase-functions')
const axios = require('axios').default
const xmlParser = require('fast-xml-parser')

const addNotification = require('../utils/addNotification')


const getFeedItems = (feedData) => {
  if (feedData && feedData.hasOwnProperty('rss')) {
    return feedData && feedData.rss && feedData.rss.channel.item
  }
  return feedData && feedData.feed && feedData.feed.entry
}

const getFeed = async (feedUrl) => {
  return axios.get(feedUrl)
}

const handleFeedQueue = async (storeId, feedUrl) => {
  const { data: feedData } = await getFeed(feedUrl)
  parsedFeed = xmlParser.parse(feedData)
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
      const { resource, store_id, body } = notification

      switch (resource) {
        case 'applications':
          if (body && body.feed_url) {
            await handleFeedQueue(store_id, body.feed_url)
          }
          break;

        default:
          break;
      }
    } catch (error) {

    }
  })


module.exports = {
  handleFeedQueue
}