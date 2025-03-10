require('dotenv').config()
const esbuild = require('esbuild')

// Log environment variables for debugging
console.log('Building widget with environment:', {
  NEXT_PUBLIC_PUSHER_APP_KEY: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
  NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
})

esbuild
  .build({
    entryPoints: ['public/widget.js'],
    bundle: true,
    minify: true,
    outfile: 'public/widget.bundle.js',
    format: 'iife',
    globalName: 'ChatWidgetModule',
    loader: {
      '.js': 'jsx',
    },
    define: {
      'process.env.NEXT_PUBLIC_PUSHER_APP_KEY': JSON.stringify(process.env.NEXT_PUBLIC_PUSHER_APP_KEY),
      'process.env.NEXT_PUBLIC_PUSHER_CLUSTER': JSON.stringify(process.env.NEXT_PUBLIC_PUSHER_CLUSTER),
      'global': 'window',
    },
    banner: {
      js: 'window.ChatWidget = undefined;',
    },
    footer: {
      js: 'window.ChatWidget = ChatWidgetModule.default;',
    },
    plugins: [{
      name: 'external-globals',
      setup(build) {
        build.onResolve({ filter: /^react$/ }, () => {
          return { path: 'react', namespace: 'external-globals' }
        })
        build.onResolve({ filter: /^react-dom$/ }, () => {
          return { path: 'react-dom', namespace: 'external-globals' }
        })
        build.onLoad({ filter: /.*/, namespace: 'external-globals' }, args => {
          const globals = {
            react: 'React',
            'react-dom': 'ReactDOM',
          }
          return {
            contents: `module.exports = ${globals[args.path]};`,
            loader: 'js',
          }
        })
      }
    }]
  })
  .then(() => {
    console.log('Widget bundle built successfully')
  })
  .catch((error) => {
    console.error('Error building widget bundle:', error)
    process.exit(1)
  })