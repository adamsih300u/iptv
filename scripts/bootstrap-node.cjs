const https = require('https')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const VERSION = 'v22.22.0'
const ZIP_NAME = `node-${VERSION}-win-x64.zip`
const URL = `https://nodejs.org/dist/${VERSION}/${ZIP_NAME}`
const ZIP = path.join(process.env.TEMP || '/tmp', ZIP_NAME)
const DEST = path.resolve(__dirname, '..', '.tools')

function get(url, file) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file)
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          out.close()
          try {
            fs.unlinkSync(file)
          } catch (_) {
            /* ignore */
          }
          return get(res.headers.location, file).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        res.pipe(out)
        out.on('finish', () => out.close(resolve))
      })
      .on('error', reject)
  })
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true })
  console.log(`Downloading ${URL}`)
  await get(URL, ZIP)
  console.log(`Extracting to ${DEST}`)
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${ZIP.replace(/'/g, "''")}' -DestinationPath '${DEST.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' },
  )
  const nodeDir = path.join(DEST, `node-${VERSION}-win-x64`)
  console.log('Ready:', path.join(nodeDir, 'node.exe'))
  console.log('npm:', path.join(nodeDir, 'npm.cmd'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
