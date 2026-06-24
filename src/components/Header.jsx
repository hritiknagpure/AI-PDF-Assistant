import './../styles/Header.css'

/**
 * Top application bar.
 *
 * Props:
 *  - darkMode     : boolean   current theme state
 *  - onToggleTheme: ()=>void  flips dark/light mode
 *  - onClearAll   : ()=>void  removes PDF + chat
 *  - hasContent   : boolean   enables the "Clear" button
 */
function Header({ darkMode, onToggleTheme, onClearAll, hasContent }) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo" aria-hidden="true">
          📑
        </span>
        <div>
          <h1 className="header__title">AI PDF Assistant</h1>
          <p className="header__subtitle">Chat with your documents</p>
        </div>
      </div>

      <div className="header__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onToggleTheme}
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>

        <button
          type="button"
          className="btn btn--danger"
          onClick={onClearAll}
          disabled={!hasContent}
          title="Clear PDF and chat"
        >
          🗑️ Clear
        </button>
      </div>
    </header>
  )
}

export default Header
