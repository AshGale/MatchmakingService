import React from 'react';
import './App.css';
// Import components as needed
import { ErrorMessage, LoadingSpinner } from './components';


function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Matchmaking Service</h1>
        <p>Welcome to the Matchmaking Service application</p>
      </header>
      <main>
        {/* Main content will go here */}
        <LoadingSpinner />
      </main>
    </div>
  );
}

export default App;
