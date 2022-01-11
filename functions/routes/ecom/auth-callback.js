// E-Com Plus Procedures to register
const { procedures } = require('./../../ecom.config')
// handle Store API errors
const errorHandling = require('./../../lib/store-api/error-handling')

const CryptJS = require('crypto-js/md5')

const { operatorToken } = require('./../../__env')
const updateAppData = require('./../../lib/store-api/update-app-data')
const { logger } = require('firebase-functions')

exports.post = ({ appSdk }, req, res) => {
  const { storeId } = req

  // handle callback with E-Com Plus app SDK
  // https://github.com/ecomplus/application-sdk
  appSdk.handleCallback(storeId, req.body)
    .then(({ isNew, authenticationId }) => {
      if (isNew) {
        console.log(`Installing store #${storeId}`)
        /**
         * You may also want to send request to external server here:

        return require('axios').post(`https://yourserver.com/new-ecom-store?store_id=${storeId}`, {
          store_id: storeId,
          authentication_id: authenticationId
        })

         */
      }

      // not new store, just refreshing access token
      if (procedures.length) {
        return appSdk.getAuth(storeId, authenticationId).then(auth => {
          const { row, docRef } = auth
          if (!row.setted_up) {
            console.log(`Try saving procedures for store #${storeId}`)
            /**
             * You may want to be notified when app "self" data is edited:

            procedures[0].triggers.push({
              resource: 'applications',
              resource_id: row.application_id,
              field: 'data'
            })

             */

            // must save procedures once only
            return appSdk.saveProcedures(storeId, procedures, auth)
              .then(() => docRef.set({ setted_up: true }, { merge: true }))
              .then(() => {
                const hash = CryptJS(storeId, operatorToken)
                updateAppData({ appSdk, storeId, auth }, { __token: hash.toString() }, true)
                logger.log('info', `success to generate token from ${storeId} | token: ${hash.toString()}`)
              })
              /**
               * You may want additional request to your server with tokens after store setup:

              .then(() => {
                return require('axios').post(`https://yourserver.com/ecom-store-setup?store_id=${storeId}`, {
                  store_id: storeId,
                  authentication_id: authenticationId,
                  access_token: auth.accessToken
                })
              })

               */
          }
        })
      }
    })

    .then(() => {
      // authentication tokens were updated
      res.status(204)
      res.end()
    })

    .catch(err => {
      const { message, response } = err
      if (response) {
        errorHandling(err)
      } else {
        // Firestore error ?
        console.error(err)
      }
      res.status(500)
      res.send({
        error: 'auth_callback_error',
        message
      })
    })
}
