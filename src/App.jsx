import { useState } from 'react'
import Simulation1 from './components/Simulation1'
import Simulation2 from './components/Simulation2'
import Simulation3 from './components/Simulation3'
import { Button } from './components/ui/button'

function App() {
  const [activeSimulation, setActiveSimulation] = useState(3)

  const simulations = [
    { id: 1, name: 'Relativistic Accretion Physics', component: Simulation1 },
    { id: 2, name: 'Magnetically Confined Jets', component: Simulation2 },
    { id: 3, name: 'Observatory View', component: Simulation3 },
  ]

  const ActiveComponent = simulations.find(s => s.id === activeSimulation)?.component

  return (
    <div className="relative w-full h-screen">
      {/* Simulation Selector */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md border border-cyan-500/50 rounded-lg px-4 py-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-sm mr-2">TON 618 Simulations:</h2>
          {simulations.map(sim => (
            <Button
              key={sim.id}
              onClick={() => setActiveSimulation(sim.id)}
              variant={activeSimulation === sim.id ? "default" : "outline"}
              size="sm"
              className="text-xs"
            >
              {sim.id}. {sim.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Active Simulation */}
      {ActiveComponent && <ActiveComponent />}
    </div>
  )
}

export default App
