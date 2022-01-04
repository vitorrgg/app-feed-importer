const ExcelJS = require('exceljs')
const path = require('path')

const run = async () => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = await workbook.csv.readFile(path.join(__dirname, 'lojaintegrada.csv'), { parserOptions: { delimiter: ';' } })
  worksheet.eachRow((row, index) => {
    if (index === 1) {
      console.log(row.getCell(1).text)
      worksheet.getColumn(1).key = 'id'
      worksheet.getColumn(10).key = 'nome'
    }
    console.log(row.getCell('id').text, ' - ', row.getCell('nome').text)
  })
}

run()
