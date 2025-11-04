import React from 'react'
import MapView from './components/MapView'
import './index.css'

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>FlightPlanner — Frontend</h1>
      </header>
      <main>
        <MapView />
      </main>
    </div>
  )
}
