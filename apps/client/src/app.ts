import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { ensureAuth } from './lib/api'

import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    ensureAuth().catch((error) => console.warn('auth failed', error))
  })

  return children
}

export default App
