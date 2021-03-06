import React from 'react'
import { createStore, applyMiddleware, compose } from 'redux' 
import thunkMiddleware from 'redux-thunk'
import reducers from './reducers'
import { renderToString } from 'react-dom/server'
import { Provider } from 'react-redux'
import { StaticRouter } from 'react-router'
import DocumentMeta from 'react-document-meta'
import { ServerStyleSheet } from 'styled-components'
import {promisify} from 'util'
import App from './app'
import useragent from 'useragent';

const gm = require('gm').subClass({imageMagick: true});


const htmlToString = (store, req, context) => {  
  const sheet = new ServerStyleSheet()
  const app = (
    <Provider store={store}>
      <StaticRouter
        location={req.url}
        context={context}>
          <App />
      </StaticRouter>
    </Provider>
  )
  const body = renderToString(sheet.collectStyles(app))
  
  return `
      <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        {{meta}}
        ${sheet.getStyleTags()}
        {{cssBundles}}
        {{thumbsCSS}}
        
        <!-- Global site tag (gtag.js) - Google Analytics -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=UA-59876038-7"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
        
          gtag('config', 'UA-59876038-7');
        </script>
                
      </head>
      <body>
        <div id="app">
          ${body}
        </div>
        <script>window.__INITIAL_STATE = {{initialState}}</script>
        {{jsBundles}}
      </body>
      </html>
  `
}

const render = (initialState, req, res) => {
  return new Promise((resolve, reject) => {
    var agent = useragent.parse(req.headers['user-agent']);
    initialState.other.unsupported = agent.family === "IE";
    
    // Create store with the initial state generated by the server
    var store = createStore(  
        reducers,
        initialState,
        compose(
          applyMiddleware(thunkMiddleware)        
        )
      )
    var context = {store, promises:[]}

    //  Render the app using the context and store
    var body = htmlToString(store, req, context)
    
    
    // All components having promises are now fetching data
    Promise.all(context.promises)
      .then(async () => {


        context.resolved = true 
        // Rendering AGAIN with new store. Stupid performance wise. OK for less code
        // A better way could be to use a router config as specified in react-router 4 docs
        var RenderedApp = htmlToString(store, req, context)
        const thumbsCSS = '' //await generateThumbnails(RenderedApp)
        
        // Get meta data
        const meta = DocumentMeta.renderAsHTML();
        
        var jsBundles, cssBundles
        if(process.env.NODE_ENV === "development"){
          //  Get paths to the webpack generated bundles
          const assetsByChunkName = res.locals.webpackStats.toJson().assetsByChunkName
          jsBundles = normalizeAssets(assetsByChunkName.main)
              .filter(path => path.endsWith('.js'))
              .map(path => `<script src="${path}"></script>`)
              .join('\n')
          cssBundles = normalizeAssets(assetsByChunkName.main)
              .filter(path => path.endsWith('.css'))
              .map(path => `<link rel="stylesheet" href="${path}" />`)
              .join('\n')
        }else{
          jsBundles = '<script src="/build/static/js/main.js"></script>'
          cssBundles = '<link rel="stylesheet" href="/build/static/css/main.css" />'
        }

        // Create new html
        RenderedApp = RenderedApp.replace('{{initialState}}', JSON.stringify(store.getState()))
        RenderedApp = RenderedApp.replace('{{meta}}', meta)
        RenderedApp = RenderedApp.replace('{{cssBundles}}', cssBundles)
        RenderedApp = RenderedApp.replace('{{jsBundles}}', jsBundles)
        RenderedApp = RenderedApp.replace('{{thumbsCSS}}', thumbsCSS)
        
        // Serve it. Bon appetite
        resolve(RenderedApp)
      })
      .catch((err) => reject(err))
    })
} 

// This function makes server rendering of asset references consistent with different webpack chunk/entry confiugrations
function normalizeAssets(assets) {
  return Array.isArray(assets) ? assets : [assets]
}

/**
 * @param  {} body
 */
const generateThumbnails = async (body) => {
  const cssRules = await Promise.all(
    body.split(/(<div[^>]+><\/div>)/)
        .map(async item=>{
          if(item.indexOf('cude-image-server-render') !== -1){
            const id = /id="([^"]+)"/.exec(item)[1]
            const src = /src="([^"]+)"/.exec(item)[1]
            const img = gm(src)
            const sizeFunc = promisify(img.size.bind(img))
            let {width, height} = await sizeFunc()
            const thumbFunc = promisify(img.resize(8,8).toBuffer.bind(img))
            const thumb = await thumbFunc('PNG');
            const thumbURL = `data:image/png;base64,${thumb.toString('base64')}` 
            let ratio = height/width 
            if(ratio > 1){
              const margin = width*0.2*2 // 20% subtracted each side
              height = (width-margin)*ratio // new height after margin added
              ratio = height/width // new ratio
            }
            
            return ` 
              #${id}{
                padding-top: ${ratio*100}%;
                margin: 0 ${ratio > 1 ? "20%" :""};
                background: url(${thumbURL});
                background-size: 100% 100%;
              }
              `
      }
    })
  )

  return `<style type="text/css">${cssRules.join('')}</style>`
  
}


export {render}

