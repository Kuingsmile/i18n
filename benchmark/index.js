import { PerformanceObserver, performance } from 'node:perf_hooks';

const config = {
  CNT: 1000000,
  WARMUP_CNT: 100000,
  ITERATIONS: 5,
  SHOW_PROGRESS: true,
  DETAILED_STATS: true
};

const { CNT, WARMUP_CNT, ITERATIONS, DETAILED_STATS } = config;

const TEMPLATE = 'There are ${bookCnt} books for ${childrenCnt} children';
const args = {
  bookCnt: 4,
  childrenCnt: 2,
};

const results = new Map();

const obs = new PerformanceObserver((items) => {
  const entry = items.getEntries()[0];
  if (!results.has(entry.name)) {
    results.set(entry.name, []);
  }
  results.get(entry.name).push(entry.duration);
  performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });

function formatByStringReplace(tpl, args) {
  return Object.keys(args).reduce((res, key) => {
    return res.replace('${' + key + '}', args[key]);
  }, tpl);
}

function formatByNewFunction(tpl, args) {
  const keys = Object.keys(args);
  const values = keys.map((key) => args[key]);
  return new Function(keys.join(','), `return \`${tpl}\``)(...values);
}

function formatByRegExp(tpl, args) {
  return tpl.replace(/\$\{([^\}]+)\}/g, function (_match, key) {
    return args[key];
  });
}

function formatByTemplate(tpl, args) {
  return tpl.replace(/\$\{([^\}]+)\}/g, (_match, key) => args[key]);
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss / 1024 / 1024, // MB
    heapUsed: usage.heapUsed / 1024 / 1024, // MB
    heapTotal: usage.heapTotal / 1024 / 1024, // MB
  };
}

function formatNumber(num) {
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function calculateStats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const opsPerSecond = CNT / (avg / 1000);
  
  return { avg, min, max, median, opsPerSecond };
}

function warmup(fn, template, args, count) {
  if (config.SHOW_PROGRESS) {
    process.stdout.write(`Warming up ${fn.name}...`);
  }
  for (let i = 0; i < count; i++) {
    fn(template, args);
  }
  if (config.SHOW_PROGRESS) {
    console.log(' ✓');
  }
}

function benchmark(name, fn, template, args, iterations) {
  if (config.SHOW_PROGRESS) {
    console.log(`\nBenchmarking ${name}...`);
  }
  
  warmup(fn, template, args, WARMUP_CNT);
  
  const times = [];
  for (let iter = 0; iter < iterations; iter++) {
    if (global.gc) {
      global.gc();
    }
    
    if (config.SHOW_PROGRESS) {
      process.stdout.write(`  Iteration ${iter + 1}/${iterations}...`);
    }
    
    const start = performance.now();
    for (let i = 0; i < CNT; i++) {
      fn(template, args);
    }
    const end = performance.now();
    times.push(end - start);
    
    if (config.SHOW_PROGRESS) {
      console.log(` ${(end - start).toFixed(2)}ms`);
    }
  }
  
  results.set(name, times);
  return times;
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(80));
  console.log(`Operations per test: ${formatNumber(CNT)}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Warmup operations: ${formatNumber(WARMUP_CNT)}`);
  console.log('='.repeat(80));

  const finalStats = new Map();
  for (const [method, times] of results) {
    finalStats.set(method, calculateStats(times));
  }

  const sortedMethods = Array.from(finalStats.entries())
    .sort((a, b) => a[1].avg - b[1].avg);

  if (DETAILED_STATS) {
    console.log('\nDETAILED RESULTS:');
    console.log('-'.repeat(110));
    console.log('Method'.padEnd(20) + 
                'Avg (ms)'.padStart(12) + 
                'Min (ms)'.padStart(12) + 
                'Max (ms)'.padStart(12) + 
                'Median (ms)'.padStart(14) + 
                'Ops/sec'.padStart(15) + 
                'Relative'.padStart(12));
    console.log('-'.repeat(110));

    const baseline = sortedMethods[0][1].avg;
    
    sortedMethods.forEach(([method, stat]) => {
      const relative = (stat.avg / baseline).toFixed(2) + 'x';
      console.log(
        method.padEnd(20) + 
        formatNumber(stat.avg).padStart(12) + 
        formatNumber(stat.min).padStart(12) + 
        formatNumber(stat.max).padStart(12) + 
        formatNumber(stat.median).padStart(14) + 
        formatNumber(stat.opsPerSecond).padStart(15) + 
        relative.padStart(12)
      );
    });

    console.log('-'.repeat(110));
  }

  console.log('\nPERFORMANCE RANKING:');
  console.log('-'.repeat(40));
  const baseline = sortedMethods[0][1].avg;
  sortedMethods.forEach(([method, stat], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    const improvement = index === 0 ? 'FASTEST' : 
                       `${((stat.avg / baseline - 1) * 100).toFixed(1)}% slower`;
    console.log(`${medal} ${(index + 1).toString().padStart(2)}. ${method.padEnd(20)} - ${improvement}`);
  });

  const memUsage = getMemoryUsage();
  console.log('\nMEMORY USAGE:');
  console.log('-'.repeat(40));
  console.log(`RSS: ${formatNumber(memUsage.rss)} MB`);
  console.log(`Heap Used: ${formatNumber(memUsage.heapUsed)} MB`);
  console.log(`Heap Total: ${formatNumber(memUsage.heapTotal)} MB`);
  
  if (config.DETAILED_STATS) {
    console.log('\nPERFORMANCE VISUALIZATION:');
    console.log('-'.repeat(60));
    const maxOps = Math.max(...sortedMethods.map(([, stat]) => stat.opsPerSecond));
    
    sortedMethods.forEach(([method, stat]) => {
      const barLength = Math.round((stat.opsPerSecond / maxOps) * 40);
      const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);
      console.log(`${method.padEnd(15)} |${bar}| ${formatNumber(stat.opsPerSecond)} ops/s`);
    });
    console.log('-'.repeat(60));
  }

  console.log('\n' + '='.repeat(80));
}

async function runBenchmarks() {
  console.log('🚀 Starting I18n Template Formatting Benchmark');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  
  const startTime = Date.now();
  
  console.log('\n📋 Testing correctness...');
  const expected = 'There are 4 books for 2 children';
  const methods = [
    ['stringReplace', formatByStringReplace],
    ['newFunction', formatByNewFunction],
    ['regExp', formatByRegExp],
    ['template', formatByTemplate]
  ];
  
  methods.forEach(([name, fn]) => {
    const result = fn(TEMPLATE, args);
    const correct = result === expected;
    console.log(`${correct ? '✅' : '❌'} ${name}: ${result}`);
    if (!correct) {
      console.error(`Expected: ${expected}`);
      process.exit(1);
    }
  });
  
  console.log('\n⏱️  Running performance benchmarks...');
  
  benchmark('stringReplace', formatByStringReplace, TEMPLATE, args, ITERATIONS);
  benchmark('newFunction', formatByNewFunction, TEMPLATE, args, ITERATIONS);
  benchmark('regExp', formatByRegExp, TEMPLATE, args, ITERATIONS);
  benchmark('template', formatByTemplate, TEMPLATE, args, ITERATIONS);
  
  printResults();
  
  const endTime = Date.now();
  console.log(`\nTotal benchmark time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
}

runBenchmarks().catch(console.error);
