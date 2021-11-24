const { logger } = require('firebase-functions')
const slugify = require('slugify')
const axios = require('axios')
const ecomUtils = require('@ecomplus/utils')
const FormData = require('form-data')

const SPECIFICATION_MAP = require('./specifications-map')

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

const getSpecifications = (feedProduct) => {
  const specifications = {}
  for (const specification of SPECIFICATION_MAP) {
    let feedSpecifications = getFeedValueByKey(specification.attribute, feedProduct)
    feedSpecifications = Array.isArray(feedSpecifications) ? feedSpecifications : [feedSpecifications]
    for (const feedSpecification of feedSpecifications) {
      if (feedSpecification) {
        specifications[specification.attribute] = [
          {
            text: feedSpecification,
            value: typeof specification.formatter === 'function' ? specification.formater(feedSpecification) : feedSpecification
          }
        ]
      }
    }
  }
  return specifications
}

const tryImageUpload = async (storeId, auth, originImgUrl, product) => {
  try {
    const { data: imageToUpload } = await axios.get(originImgUrl, { responseType: 'arraybuffer' })
    const form = new FormData()
    form.append('file', Buffer.from(imageToUpload), originImgUrl.replace(/.*\/([^/]+)$/, '$1'))
    const { data, status } = await axios.post(`https://apx-storage.e-com.plus/${storeId}/api/v1/upload.json`, form, {
      headers: {
        ...form.getHeaders(),
        'X-Store-ID': storeId,
        'X-My-ID': auth.myId,
        'X-Access-Token': auth.accessToken
      }
    })

    if (data.picture) {
      for (const imgSize in data.picture) {
        if (data.picture[imgSize]) {
          if (!data.picture[imgSize].url) {
            delete data.picture[imgSize]
            continue
          }
          if (data.picture[imgSize].size !== undefined) {
            delete data.picture[imgSize].size
          }
          data.picture[imgSize].alt = `${product.name} (${imgSize})`
        }
      }
      if (Object.keys(data.picture).length) {
        return {
          _id: ecomUtils.randomObjectId(),
          ...data.picture
        }
      }

      const err = new Error('Unexpected Storage API responde')
      err.response = { data, status }
      throw err
    }
  } catch (error) {
    logger.error('[PRODUCT-TO-ECOM:tryImageUpload | ERROR]', error)
  }
}

const parseProduct = async (appData, auth, storeId, feedProduct, product) => {
  try {
    const newProductData = {
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
      specifications: getSpecifications(feedProduct)
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

    product = Object.assign(product, newProductData)
    const picturePromises = []

    for (const image of getFeedValueByKey('additional_image_link', feedProduct) || []) {
      picturePromises.push(tryImageUpload(storeId, auth, image, product))
    }
    product.pictures = await Promise.all(picturePromises) || []
    const imageLink = getFeedValueByKey('image_link', feedProduct)
    if (imageLink) {
      product.pictures.push(await tryImageUpload(storeId, auth, imageLink, product))
    }

    delete product._id
    return product
  } catch (error) {
    logger.error('[PRODUCT-TO-ECOM:parseProduct | ERROR]', error)
  }
}

const saveEcomProduct = async (appSdk, appData, storeId, feedProduct) => {
  try {
    storeId = storeId.toString()
    const auth = await appSdk.getAuth(parseInt(storeId, 10))
    const sku = (getFeedValueByKey('id', feedProduct) || getFeedValueByKey('sku', feedProduct)).toString()
    const { result } = await findEcomProductBySKU(appSdk, storeId, sku)
    const product = result.length > 0 ? result[0] : {}
    const { _id } = product
    const resource = _id ? `/products/${_id}.json` : '/products.json'
    const method = _id ? 'PATCH' : 'POST'
    const parsedProduct = await parseProduct(appData, auth, storeId, feedProduct, product)
    let ecomResponse = {}

    if (appData.update_product || method === 'POST') {
      const { response } = await appSdk.apiRequest(parseInt(storeId), resource, method, parsedProduct)
      ecomResponse = response.data || { _id }
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
  saveEcomProduct,
  getSpecifications
}
