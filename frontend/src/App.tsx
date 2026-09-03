import './App.css'
import KudosDashboard from './pages/Dashboard'

export default function App() {
  return (
    <div className="app-shell">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
          <h1 className="text-3xl font-bold text-gray-900">Kudos</h1>
          <p className="mt-1 text-gray-500">Recognize and appreciate your colleagues.</p>
        </div>
      </header>
      <main><KudosDashboard /></main>
    </div>
  )
}
