#!/usr/bin/env node
// prints a fixed candidate array to stdout
process.stdout.write(JSON.stringify([
  { sourceKey: 'K1', title: 'from fake', desc: 'd', from: 'PM', sourceMeta: { url: 'u' } },
]))
