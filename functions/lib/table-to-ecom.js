const ExcelJS = require('exceljs')
const slugify = require('slugify')
const { Duplex } = require('stream')

const MAPPED_COLUMNS = [
  {
    tableColumn: 'id',
    feedColumn: 'g:id'
  },
  {
    tableColumn: 'nome',
    feedColumn: 'g:title',
    parser: (_, value) => {
      console.log(value)
      return value
    }
  },
  {
    tableColumn: 'sku',
    feedColumn: 'g:sku'
  },
  {
    tableColumn: 'tipo',
    feedColumn: 'g:item_group_id',
    parser: (row, value) => {
      if (['variacao', 'com-variacao'].includes(value)) {
        const sku = row.getCell('g:sku').text
        if (sku) {
          return sku.split('-')[0]
        }
      }
      return ''
    }
  },
  {
    tableColumn: 'usado',
    feedColumn: 'g:condition',
    parser: (_, value) => {
      if (value === 'N') {
        return 'new'
      }
      return 'used'
    }
  },
  {
    tableColumn: 'descricao-completa',
    feedColumn: 'g:description'
  },
  {
    tableColumn: 'imagem-1',
    feedColumn: 'g:image_link',
    parser: (row, value, options = {}) => {
      console.log('row', row)
      console.log('value',value)
      console.log('options', options)
      const { data, worksheet } = options
      const images = []
      data['g:additional_image_link'] = images
      row.eachCell((_, columnNumber) => {
        const key = worksheet.getColumn(columnNumber).key
        if (key && key.indexOf('imagem-') !== -1) {
          images.push(row.getCell(key).text)
        }
        if (images.length > 0) {
          data['g:additional_image_link'] = images
        }
      })
      if (!value && images.length > 0) {
        return images[0]
      }
      return value
    }
  },
  {
    tableColumn: 'estoque-quantidade',
    feedColumn: 'g:availability',
    parser: (row, value) => {
      if (value && Number(value) > 0) {
        return 'in stock'
      }
      return 'out of stock'
    }
  },
  {
    tableColumn: 'preco-cheio',
    feedColumn: 'g:sale_price'
  },
  {
    tableColumn: 'marca',
    feedColumn: 'g:brand'
  },
  {
    tableColumn: 'categoria-nome-nivel-1',
    feedColumn: 'g:google_product_category',
    parser: (row, _, options = {}) => {
      const { worksheet } = options
      const categories = []
      row.eachCell((_, columnNumber) => {
        const key = worksheet.getColumn(columnNumber).key
        if (key && key.indexOf('categoria-nome') !== -1) {
          categories.push(row.getCell(key).text)
        }
      })
      return categories.join('>')
    }
  },
  {
    tableColumn: 'grade-genero',
    feedColumn: 'g:gender',
    parser: (_, value) => {
      if (value) {
        switch (value) {
          case 'feminino':
            return 'Female'
          case 'unisex':
            return 'Unisex'
          default:
            return 'Male'
        }
      }
      return ''
    }
  },
  {
    tableColumn: 'grupo-idade',
    feedColumn: 'g:age_group',
    parser: (_, value) => {
      if (value) {
        switch (value.toLowerCase()) {
          case 'recem nascida':
            return 'adult'
          case 'infantil':
            return 'infant'
          case 'crianca pequena':
            return 'toddler'
          case 'criancas':
            return 'kids'
          default:
            return 'adult'
        }
      }
      return ''
    }
  },
  {
    tableColumn: 'grade-produto-com-uma-cor',
    feedColumn: 'g:color',
    parser: (_, value, options = {}) => {
      console.log(value)
      const { data } = options
      if (data && data['g:color']) {
        return data['g:color']
      }
      return value
    }
  },
  {
    tableColumn: 'grade-produto-com-duas-cores',
    feedColumn: 'g:color',
    parser: (_, value, options = {}) => {
      const { data } = options
      console.log(value)
      if (data && data['g:color']) {
        return data['g:color']
      }
      return value
    }
  },
  {
    tableColumn: 'tamanho',
    feedColumn: 'g:size',
    parser: (_, value) => {
      return value
    }
  },
  {
    tableColumn: 'gtin',
    feedColumn: 'g:gtin'
  },
  {
    tableColumn: 'seo-tag-title',
    feedColumn: 'g:meta_title'
  },
  {
    tableColumn: 'seo-tag-description',
    feedColumn: 'g:meta_description'
  },
  {
    tableColumn: 'peso-em-kg',
    feedColumn: 'g:shipping_weight',
    parser: (_, value) => {
      return `${value || '0'} kg`
    }
  }
]

const getKey = (key) => {
  return slugify(key, { strict: true, replacet: '_', lower: true })
}

const parseProduct = async (buffer, contentType) => {
  try {
    const workbook = new ExcelJS.Workbook()
    let worksheet
    if (contentType === 'text/csv') {
      const stream = new Duplex()
      stream.push(buffer)
      stream.push(null)
      worksheet = await workbook.csv.read(stream, { parserOptions: { delimiter: ';' } })
    } else {
      worksheet = await workbook.xlsx.load(buffer)
    }
    const values = []
    const columns = []
    console.log('Test worksheet')
    const sheetResult = worksheet.getWorksheet(1)
    sheetResult.eachRow((row, index) => {
      console.log('Each row', index)
      if (index === 1) {
        row.eachCell((cell, columnNumber) => {
          let key = (MAPPED_COLUMNS.find(({ tableColumn }) => tableColumn === getKey(cell.text)) || {}).feedColumn
          key = key || getKey(cell.text)
          console.log('--get key ---')
          console.log(key)
          if (key) {
            sheetResult.getColumn(columnNumber).key = key
            columns.push(getKey(cell.text))
          }
        })
        console.log('--- columns ---')
        console.log(columns)
      } else {
        const data = {}
        for (const mapped of MAPPED_COLUMNS) {
          if (columns.includes(mapped.tableColumn)) {
            if (typeof mapped.parser === 'function') {
              data[mapped.feedColumn] = mapped.parser(row, row.getCell(mapped.feedColumn).text, { sheetResult, data })
            } else {
              data[mapped.feedColumn] = row.getCell(mapped.feedColumn).text
            }
          }
        }
        values.push(data)
      }
    })
    console.log(values)
    return values
  } catch (error) {
    console.error(error)
  }
}

module.exports = {
  parseProduct
}
