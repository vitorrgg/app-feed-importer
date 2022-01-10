const fs = require('fs')
const path = require('path')
const os = require('os')
const busboy = require('busboy')
const { v4: uuid } = require('uuid')
const getAppData = require('./../../lib/store-api/get-app-data')

const addNotification = require('../../utils/addNotification')

exports.post = async ({ admin, appSdk }, req, res) => {
  const storeId = req.storeId ? req.storeId : req.query.store_id
  const token = req.query.token
  if (!storeId) {
    return res.status(403).send('storeId is required!')
  }
  const auth = await appSdk.getAuth(1117)

  const appData = await getAppData({ appSdk, storeId, auth })

  if (!token || appData.__token !== token) {
    return res.status(403).send('Unauthorized token')
  }

  const bb = busboy({ headers: req.headers })
  const tmpdir = os.tmpdir()

  const uploads = {}
  const fileWrites = []
  const guid = uuid()
  let filename = ''
  bb.on('file', (_, file, info) => {
    filename = info.filename
    console.log(`Processed file ${filename}`)
    const filepath = path.join(tmpdir, `${guid}-${filename}`)
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
      const fileId = `${guid}-${filename}`
      const [metadata] = await storageBucket.file(fileId).getMetadata()
      addNotification(admin, {
        store_id: storeId,
        body: {
          file_id: fileId,
          contentType: metadata.contentType
        },
        resource: 'feed_import_table'
      })
      fs.unlinkSync(uploads[file])
    }
    res.send()
  })

  bb.end(req.rawBody)
  res.send()
}
