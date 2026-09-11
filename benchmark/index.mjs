import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'

import * as api from '../dist/index.js'
import { createWorkloads } from './workloads.mjs'

const { values } = parseArgs({
  options: {
    samples: { type: 'string', default: '9' },
    time: { type: 'string', default: '100' },
    warmup: { type: 'string', default: '200' },
    filter: { type: 'string', default: '' },
    output: { type: 'string' },
    compare: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help) {
  console.log(`Usage: npm run benchmark -- [options]
  --samples N     Measured samples per workload (default: 9, minimum: 3)
  --time MS       Minimum duration per sample (default: 100)
  --warmup MS     Warmup per workload (default: 200)
  --filter TEXT   Run workloads whose names contain TEXT
  --output FILE   Save measurements as JSON
  --compare FILE  Compare with a previous JSON report
Times exclude build, fixture creation, assertions, and console output.
Logger methods are silenced; missing-key timings exclude terminal I/O.`)
  process.exit(0)
}

const settings = { samples: Number(values.samples), timeMs: Number(values.time), warmupMs: Number(values.warmup) }
if (
  !Number.isInteger(settings.samples) ||
  settings.samples < 3 ||
  !Number.isFinite(settings.timeMs) ||
  settings.timeMs <= 0 ||
  !Number.isFinite(settings.warmupMs) ||
  settings.warmupMs <= 0
) {
  throw new Error('Use an integer --samples >= 3 and finite, positive --time and --warmup values')
}
const baseline = values.compare ? JSON.parse(fs.readFileSync(values.compare, 'utf8')) : undefined
if (baseline && (baseline.version !== 1 || !Array.isArray(baseline.results))) {
  throw new Error('Unsupported benchmark report')
}
const metadata = {
  node: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  cpu: os.cpus()[0]?.model ?? 'unknown',
  logicalCpus: os.cpus().length,
}
if (
  baseline &&
  (JSON.stringify(baseline.metadata) !== JSON.stringify(metadata) ||
    JSON.stringify(baseline.settings) !== JSON.stringify(settings))
) {
  console.warn('Baseline environment or sampling settings differ; ratios may not be comparable.')
}

let checksum = 0
function runBatch(run, start, count) {
  let consumed = 0
  for (let i = 0; i < count; i++) {
    const value = run(start + i)
    consumed += value === undefined ? 1 : value.length
  }
  checksum = (checksum + consumed) >>> 0
}

function measure(run) {
  let index = 0
  let batchSize = 1
  // Calibrate once per workload to amortize timer overhead; cap each batch at
  // about 2 ms. Indices continue across samples to avoid resetting key rotation.
  for (;;) {
    const start = performance.now()
    runBatch(run, index, batchSize)
    const elapsed = performance.now() - start
    index += batchSize
    if (elapsed >= 2 || batchSize >= 65536) break
    batchSize *= 2
  }
  const sample = duration => {
    let operations = 0
    const start = performance.now()
    let elapsed
    do {
      runBatch(run, index, batchSize)
      index += batchSize
      operations += batchSize
      elapsed = performance.now() - start
    } while (elapsed < duration)
    return { nsPerOp: (elapsed * 1e6) / operations, operations, elapsedMs: elapsed }
  }
  sample(settings.warmupMs)
  const samples = Array.from({ length: settings.samples }, () => sample(settings.timeMs))
  const sorted = samples.map(item => item.nsPerOp).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const medianNs = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return {
    medianNs,
    opsPerSecond: 1e9 / medianNs,
    minNs: sorted[0],
    maxNs: sorted.at(-1),
    samples,
  }
}

const originals = Object.fromEntries(['log', 'warn', 'error'].map(method => [method, api.logger[method]]))
let workloads
try {
  for (const method of Object.keys(originals)) api.logger[method] = () => {}
  workloads = createWorkloads(api)
  const selected = workloads.cases.filter(item => item.name.includes(values.filter))
  if (!selected.length) throw new Error('No workloads match --filter')
  console.log(`Node ${metadata.node} | ${metadata.platform}/${metadata.arch} | ${metadata.cpu}`)
  console.log(`${settings.samples} samples x ${settings.timeMs} ms; ${settings.warmupMs} ms warmup per workload`)
  console.log('Lower ns/op is better. Speedup = baseline median / current median. Range is sample min-max.')
  console.log(
    `${'Workload'.padEnd(38)} ${'ns/op'.padStart(10)} ${'ops/sec'.padStart(13)} ${'range ns/op'.padStart(21)}${baseline ? '   speedup' : ''}`,
  )
  const results = []
  for (const { name, run } of selected) {
    const result = { name, ...measure(run) }
    results.push(result)
    const previous = baseline?.results.find(item => item.name === name)
    const ratio = previous ? `${(previous.medianNs / result.medianNs).toFixed(2)}x` : 'n/a'
    const range = `${result.minNs.toFixed(1)}-${result.maxNs.toFixed(1)}`
    console.log(
      `${name.padEnd(38)} ${result.medianNs.toFixed(1).padStart(10)} ${Math.round(result.opsPerSecond).toLocaleString('en-US').padStart(13)} ${range.padStart(21)}${baseline ? ratio.padStart(10) : ''}`,
    )
  }
  const report = { version: 1, timestamp: new Date().toISOString(), metadata, settings, results, checksum }
  if (values.output) {
    fs.mkdirSync(path.dirname(path.resolve(values.output)), { recursive: true })
    fs.writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`)
    console.log('JSON report saved.')
  }
  console.log(`Checksum: ${checksum}`)
} finally {
  for (const [method, original] of Object.entries(originals)) api.logger[method] = original
  workloads?.cleanup()
}
