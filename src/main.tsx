import { createRoot } from 'react-dom/client';
import './tokens.css';
import './styles.css';
import { App } from './ui/App';
import { setupScenario } from './engine/script';

setupScenario();

createRoot(document.getElementById('root')!).render(<App />);
