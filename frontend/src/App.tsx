import './App.css'
import KudosDashboard from '../pages/Dashboard'

function App() {
  return (
    <div className="app">

      {/* HERO */}
      <section className="hero">

        {/* Navbar */}
        <header className="navbar">

          <div className="logo">
            <div className="logo-icon">
              <span></span>
              <span></span>
            </div>
            <span>KUDOS</span>
          </div>

          <nav className="nav-links">
            <a href="#home">HOME</a>
            <a href="#kudos">KUDOS</a>
            <a href="#dashboard">DASHBOARD</a>
          </nav>

        </header>


        {/* Stars */}
        <div className="star star-1"></div>
        <div className="star star-2"></div>
        <div className="star star-3"></div>
        <div className="star star-4"></div>
        <div className="star star-5"></div>


        {/* Clouds */}
        <div className="cloud cloud-1"></div>
        <div className="cloud cloud-2"></div>
        <div className="cloud cloud-3"></div>


        {/* Moon */}
        <div className="moon"></div>


        {/* Hero content */}
        <div className="hero-content" id="home">

          <p className="eyebrow">RECOGNITION • APPRECIATION • TEAMWORK</p>

          <h1 className="hero-title">
            Give <span>Kudos.</span>
            <br />
            Spread Appreciation.
          </h1>

          <p className="hero-text">
            Celebrate the people who make your workplace better.
            Recognize great work, appreciate your teammates,
            and spread a little positivity.
          </p>

          <a href="#dashboard" className="btn">
            GIVE KUDOS
          </a>

        </div>


        {/* Mountains */}
        <div className="mountains">
          <div className="mountain-back"></div>
          <div className="mountain-middle"></div>
          <div className="mountain-front"></div>

          <div className="tree tree-1"></div>
          <div className="tree tree-2"></div>
          <div className="tree tree-3"></div>
          <div className="tree tree-4"></div>
          <div className="tree tree-5"></div>
        </div>

      </section>


      {/* EXISTING KUDOS DASHBOARD */}
      <main id="dashboard" className="dashboard-wrapper">
        <div className="dashboard-heading">
          <p className="eyebrow">KUDOS WALL</p>

          <h2>
            Celebrate your <span>team.</span>
          </h2>

          <p>
            Recognize someone's hard work and let them know
            their contribution matters.
          </p>
        </div>

        <KudosDashboard />
      </main>

    </div>
  )
}

export default App