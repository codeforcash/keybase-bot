import {spawn} from 'child_process'
import readline from 'readline'
import path from 'path'

export type ExecOptions = {
  stdinBuffer?: Buffer | string
  onStdOut?: ((line: string) => void)
  json?: boolean
  timeout?: number
}

const keybaseExec = (
  workingDir: string,
  homeDir: void | string,
  args: string[],
  options: ExecOptions = {stdinBuffer: undefined, onStdOut: undefined, timeout: undefined}
): Promise<any> => {
  const runArgs: string[] = [...args]
  if (homeDir) {
    runArgs.unshift('--home', homeDir)
  }
  const keybasePath = path.join(workingDir, 'keybase')
  const child = spawn(keybasePath, runArgs)
  const stdOutBuffer: Buffer[] = []
  const stdErrBuffer: Buffer[] = []

  if (options.stdinBuffer) {
    child.stdin.write(options.stdinBuffer)
  }
  child.stdin.end()

  const lineReaderStdout = readline.createInterface({input: child.stdout})

  // Use readline interface to parse each line (\n separated) when provided
  // with onStdOut callback
  if (options.onStdOut) {
    lineReaderStdout.on('line', options.onStdOut)
  } else {
    child.stdout.on('data', chunk => {
      stdOutBuffer.push(chunk)
    })
  }
  // Capture STDERR and use as error message if needed
  child.stderr.on('data', chunk => {
    stdErrBuffer.push(chunk)
  })

  let done = false
  if (options.timeout) {
    setTimeout(() => {
      if (!done) {
        child.kill()
      }
    }, options.timeout)
  }

  return new Promise((resolve, reject) => {
    child.on('close', code => {
      done = true

      let finalStdOut: void | string = null
      // Pass back
      if (code) {
        const errorMessage = Buffer.concat(stdErrBuffer).toString('utf8')
        reject(new Error(errorMessage))
      } else {
        const stdout = Buffer.concat(stdOutBuffer).toString('utf8')

        try {
          finalStdOut = options.json ? JSON.parse(stdout) : stdout
        } catch (e) {
          reject(e)
        }
      }
      resolve(finalStdOut)
    })
  })
}

export default keybaseExec
