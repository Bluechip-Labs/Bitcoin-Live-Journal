import { Analytics } from '@vercel/analytics/react'
import BitcoinLiveJournal from './BitcoinLiveJournal.jsx'

function App() {
  return (
    <>
      <BitcoinLiveJournal />
      <Analytics />
    </>
  )
}

export default App
