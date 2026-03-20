import nodeResolve from '@rollup/plugin-node-resolve'
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';

const copyConfig = {
  targets: [
    //{ src: 'public/index.html', dest: 'dist' },
    //{ src: 'public/404.html', dest: 'dist' },
  ],
}

const config = {
  input: 'build/index.js',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.APP_ENV': JSON.stringify(process.env.APP_ENV || 'emulator'),
    }),
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