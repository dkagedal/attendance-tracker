import nodeResolve from '@rollup/plugin-node-resolve'
import copy from 'rollup-plugin-copy';

const copyConfig = {
  targets: [
    { src: 'index.html', dest: 'public' },
  ],
}

const config = {
  input: 'build/index.js',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
  },
  plugins: [
    // minifyHTML(),
    copy(copyConfig),
    nodeResolve(),
  ],

  // Voodoo from https://github.com/WebReflection/hyperHTML/issues/304
  context: 'null',
  moduleContext: 'null',

  preserveEntrySignatures: false,
}

export default config;