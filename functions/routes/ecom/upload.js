const fs = require('fs')
const path = require('path')
const os = require('os')
const busboy = require('busboy')
const { v4: uuid } = require('uuid')

exports.post = async ({ admin, appSdk }, req, res) => {
  const bb = busboy({ headers: req.headers })
  const tmpdir = os.tmpdir()

  const uploads = {}
  const fileWrites = []
  bb.on('file', (_, file, info) => {
    const { filename } = info
    console.log(`Processed file ${filename}`)
    const filepath = path.join(tmpdir, `${uuid()}-${filename}`)
    uploads[filename] = filepath

    const writeStream = fs.createWriteStream(filepath)
    file.pipe(writeStream)

    const promise = new Promise((resolve, reject) => {
      file.on('end', () => {
        writeStream.end()
      })
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })
    fileWrites.push(promise)
  })

  bb.on('finish', async () => {
    await Promise.all(fileWrites)
    const storageBucket = admin.storage().bucket('gs://ecom-feed-importer.appspot.com')
    for (const file in uploads) {
      await storageBucket.upload(uploads[file])
      fs.unlinkSync(uploads[file])
    }
    res.send()
  })

  bb.end(req.rawBody)
}
