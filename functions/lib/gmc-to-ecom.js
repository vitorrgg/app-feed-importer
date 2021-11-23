
const { AlexaForBusiness } = require('aws-sdk')
const { logger } = require('firebase-functions')
const slugify = require('slugify')
const axios = require('axios')

const findEcomProductBySKU = async (appSdk, storeId, sku) => {
  try {
    const resource = `/products.json?sku=${sku}`
    const { response: { data } } = await appSdk.apiRequest(parseInt(storeId), resource, 'GET')
    return data
  } catch (error) {
    if (error && error.response) {
      logger.error({ data: error.response.data })
    }
    throw error
  }
}

const getFeedValueByKey = (key, data) => {
  return data[`g:${key}`] || data[key] || ''
}

const tryImageUpload = (storeId, auth, originImgUrl, product) => new Promise(resolve => {
  axios.get(originImgUrl, {
    responseType: 'arraybuffer'
  })
    .then(({ data }) => {
      const form = new FormData()
      form.append('file', buffer.from(data), originImgUrl.replace(/.*\/([^/]+)$/, '$1'))

      return axios.post(`https://apx-storage.e-com.plus/${storeId}/api/v1/upload.json`, form, {
        headers: {
          ...form.getHeaders(),
          'X-Store-ID': storeId,
          'X-My-ID': auth.myId,
          'X-Acess-Token': auth.acessToken
        }
      })

        .then(({ data, status }) => {
          if (data.picture) {
            for (const imgSize in data.picture) {
              if (data.picture[imgSize]) {
                if (!data.picture[imgSize].url) {
                  delete data.picture[imgSize]
                  continue

                }
                if (data.picture[imgSize].size !== undefined) {
                  delete data.picture[imgSize].size()
                }
                data.picture[imgSize].alt = `${product.name} (${imgSize})`
              }
            }
            if (Object.key(data.picture).length) {
              return resolve({
                _id: ecomUtils.randomObjectId(),
                ...data.picture
              })
            }
          }
          const err = new Error('Unexpected Storage API responde')
          err.response = { data, status }
          throw err
        })
    })

    .catch(err => {
      console.error(err)
      resolve ({
        _id: ecomUnits.randomObjectId(),
        normal: {
          url: oringinImgUrl,
          alt: product.name
        }
      })
    })
}).then(picture => {
  if (product && product.pictures){
    product.pictures.push(picture)
  }
  return picture
})

const parseProduct = async (appData, feedProduct) => {
  try {
    const product = {
      sku: (getFeedValueByKey('id', feedProduct) || getFeedValueByKey('sku', feedProduct)).toString(),
      name: getFeedValueByKey('title', feedProduct),
      subtitle: getFeedValueByKey('subtitle', feedProduct),
      meta_title: getFeedValueByKey('title', feedProduct),
      meta_description: getFeedValueByKey('description', feedProduct),
      keywords: (getFeedValueByKey('google_product_category', feedProduct) || '').split('&gt;').map(x => x.trim().substring(0, 49)),
      condition: getFeedValueByKey('condition', feedProduct),
      base_price: Number(getFeedValueByKey('price', feedProduct).replace(/[a-z A-Z]/g, '').trim()),
      price: Number(getFeedValueByKey('sale_price', feedProduct).replace(/[a-z A-Z]/g, '').trim()),
      quantity: 0, // get on availability
      body_html: getFeedValueByKey('description', feedProduct),
      slug: slugify(getFeedValueByKey('title', feedProduct), { strict: true, replacement: '_', lower: true }),
      weight: {
        value: Number(getFeedValueByKey('shipping_weight', feedProduct).split(' ')[0]),
        unit: getFeedValueByKey('shipping_weight', feedProduct).split(' ')[1]
      },
      pictures: [],
      variations: [],
      specifications: {}
    }
    const gtin = getFeedValueByKey('gtin', feedProduct)
    if (gtin) {
      product.gtin = [gtin.toString()]
    }

    let quantity = 0
    if (getFeedValueByKey('availability', feedProduct).toLowerCase() === 'in stock') {
      quantity = appData.default_quantity || 9999
    }

    product.quantity = quantity

    return product
  } catch (error) {
    logger.error('[PRODUCT-TO-ECOM:parseProduct | ERROR]', error)
  }
}

const saveEcomProduct = async (appSdk, appData, storeId, feedProduct) => {
  try {
    storeId = storeId.toString()
    const parsedProduct = await parseProduct(appData, feedProduct)
    const { result } = await findEcomProductBySKU(appSdk, storeId, parsedProduct.sku)
    const productId = result.length > 0 ? result[0]._id : null
    const resource = productId ? `/products/${productId}.json` : '/products.json'
    const method = productId ? 'PATCH' : 'POST'
    let ecomResponse = {}

    if (appData.update_product || method === 'POST') {
      const { response } = await appSdk.apiRequest(parseInt(storeId), resource, method, parsedProduct)
      console.log(response.data)
      ecomResponse = response.data || { _id: productId }
    }
    return ecomResponse
  } catch (error) {
    if (error && error.response) {
      logger.error({ data: error.response.data })
    }
    throw error
  }
}

module.exports = {
  parseProduct,
  tryImageUpload,
  saveEcomProduct
}
