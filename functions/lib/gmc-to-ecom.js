
const getFeedValueByKey = (key, data) => {
  return data[`g:${key}`] || data[key]
}

const parseProduct = async (feedProduct) => {
  try {
    const product = {
      sku: getFeedValueByKey('id', feedProduct) || getFeedValueByKey('sku', feedProduct),
      name: getFeedValueByKey('title', feedProduct),
      subtitle: getFeedValueByKey('subtitle', feedProduct),
      meta_title: getFeedValueByKey('title', feedProduct),
      meta_description: getFeedValueByKey('description', feedProduct),
      keywords: (getFeedValueByKey('google_product_category', feedProduct) || '').split('&gt;').map(x => x.trim())
    }

    return product
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  parseProduct
}
