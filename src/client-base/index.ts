import {ChildProcess} from 'child_process'
import {formatAPIObjectInput, formatAPIObjectOutput, keybaseExec, keybaseStatus} from '../utils'
import safeJSONStringify from '../utils/safeJSONStringify'
import {API_VERSIONS, API_TYPES} from '../constants'
import path from 'path'
import {InitOptions} from '../utils/options'
import {AdminDebugLogger} from '../utils/adminDebugLogger'

export interface ApiCommandArg {
  apiName: API_TYPES
  method: string
  options?: object
  timeout?: number
}

/**
 * A Client base.
 * @ignore
 */
class ClientBase {
  public initialized: boolean
  public username: void | string
  public devicename: void | string
  public homeDir: void | string
  public verbose: boolean
  protected _spawnedProcesses: ChildProcess[]
  private _workingDir: string
  private _initializedWithOptions: InitOptions
  protected _adminDebugLogger: AdminDebugLogger

  public constructor(workingDir: string, adminDebugLogger: AdminDebugLogger) {
    this._adminDebugLogger = adminDebugLogger
    this._workingDir = workingDir
    this.initialized = false
    this.verbose = false
    this._spawnedProcesses = []
  }

  public async _init(homeDir: void | string, options?: InitOptions): Promise<void> {
    const initBotInfo = await keybaseStatus(this._workingDir, homeDir)
    this._adminDebugLogger.info(`My workingDir=${this._workingDir} and my homeDir=${this.homeDir}`)
    this.homeDir = homeDir
    this.username = initBotInfo.username
    this.devicename = initBotInfo.devicename
    this.initialized = true
    if (options) {
      this._initializedWithOptions = options
    }
  }

  public async _deinit(): Promise<void> {
    for (const child of this._spawnedProcesses) {
      child.kill()
    }
  }

  protected async _runApiCommand(arg: ApiCommandArg): Promise<any> {
    const options = arg.options ? formatAPIObjectInput(arg.options, arg.apiName) : undefined
    const input = {
      method: arg.method,
      params: {
        version: API_VERSIONS[arg.apiName],
        options,
      },
    }
    const inputString = safeJSONStringify(input)
    const size = inputString.length
    const output = await keybaseExec(this._workingDir, this.homeDir, [arg.apiName, 'api'], {
      stdinBuffer: Buffer.alloc(size, inputString, 'utf8'),
      json: true,
      timeout: arg.timeout,
    })
    if (output.hasOwnProperty('error')) {
      throw new Error(output.error.message)
    }
    const res = formatAPIObjectOutput(output.result, {
      apiName: arg.apiName,
      method: arg.method,
    })
    return res
  }

  protected async _guardInitialized(): Promise<void> {
    if (!this.initialized) {
      throw new Error('The client is not yet initialized.')
    }
  }
  protected _pathToKeybaseBinary(): string {
    return path.join(this._workingDir, 'keybase')
  }
}

export default ClientBase
