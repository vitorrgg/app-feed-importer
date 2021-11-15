const functions = require('firebase-functions')
const updateAppData = require('./../../lib/store-api/update-app-data')


// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'


const addNotification = (admin, trigger) => {
  functions.logger.info('[addNotification]', trigger)
  return admin.firestore()
    .collection('ecom_notifications')
    .add(trigger)
}


exports.post = ({ admin, appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body

  // get app configured options
  getAppData({ appSdk, storeId })

    .then(appData => {
      if (
        Array.isArray(appData.ignore_triggers) &&
        appData.ignore_triggers.indexOf(trigger.resource) > -1
      ) {
        // ignore current trigger
        const err = new Error()
        err.name = SKIP_TRIGGER_NAME
        throw err
      }

      const { body, fields, resource, action } = trigger

      functions.logger.info('[WEBHOOK TRIGGER]', trigger)

      switch (resource) {
        case 'applications':
          if (Array.isArray(fields) && fields.includes('data')) {
            if (body.feed_url) {
              addNotification(admin, trigger)
            }

            updateAppData({ appSdk, storeId, auth }, { feed_url: '' })
          }
          break
        default:
          break
      }

      res.send(ECHO_SUCCESS)
    })

    .catch(err => {
      if (err.name === SKIP_TRIGGER_NAME) {
        // trigger ignored by app configuration
        res.send(ECHO_SKIP)
      } else if (err.appWithoutAuth === true) {
        const msg = `Webhook for ${storeId} unhandled with no authentication found`
        const error = new Error(msg)
        error.trigger = JSON.stringify(trigger)
        console.error(error)
        res.status(412).send(msg)
      } else {
        // console.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          error: ECHO_API_ERROR,
          message
        })
      }
    })
}
