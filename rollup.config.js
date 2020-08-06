import rollupTypescript from '@rollup/plugin-typescript';

export default {
  input: 'src/minimap.ts',
  output: {
    file: 'index.js',
    format: 'umd',
    name: 'CodemirrorMinimap',
    sourcemap: true
  },
  
  plugins: [
    rollupTypescript({lib: ['es5', 'es6', 'dom'], target: 'es5', allowSyntheticDefaultImports: true })
  ],
  external: ['lodash', 'codemirror']
};