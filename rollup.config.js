import resolve from '@rollup/plugin-node-resolve'

export default {
    input: 'index.js',
    output: {
        dir: 'public',
        format: 'esm'
    },
    plugins:  [ resolve() ]
}
